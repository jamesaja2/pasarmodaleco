import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { broadcastNotification } from '@/lib/realtime-server'

const schema = z.object({
  dayNumber: z.number().int().min(0).max(365),
  reportContent: z.string().min(3),
  pdfUrl: z.string().url(),
  isAvailable: z.boolean().optional(),
})

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await context.params

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, stockCode: true, companyName: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const reports = await prisma.financialReport.findMany({
      where: { companyId: company.id },
      orderBy: { dayNumber: 'asc' },
    })

    return NextResponse.json({
      company: {
        id: company.id,
        stockCode: company.stockCode,
        name: company.companyName,
      },
      reports: reports.map((report) => ({
        id: report.id,
        dayNumber: report.dayNumber,
        reportContent: report.reportContent,
        pdfUrl: report.pdfUrl ?? null,
        isAvailable: report.isAvailable,
        updatedAt: report.updatedAt,
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch financial reports', error)
    return NextResponse.json({ error: 'Failed to fetch financial reports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = schema.parse(body)

    const { id } = await context.params
    const company = await prisma.company.findUnique({ where: { id } })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const report = await prisma.financialReport.upsert({
      where: {
        companyId_dayNumber: {
          companyId: company.id,
          dayNumber: data.dayNumber,
        },
      },
      update: {
        reportContent: data.reportContent,
        pdfUrl: data.pdfUrl,
        isAvailable: data.isAvailable ?? true,
      },
      create: {
        companyId: company.id,
        dayNumber: data.dayNumber,
        reportContent: data.reportContent,
        pdfUrl: data.pdfUrl,
        isAvailable: data.isAvailable ?? true,
      },
    })

    if (report.isAvailable) {
      broadcastNotification({
        type: 'info',
        title: 'Laporan Keuangan Baru',
        message: `Laporan keuangan hari ${report.dayNumber} untuk ${company.companyName} siap dibaca.`,
      })
    }

    return NextResponse.json({ success: true, report })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to upsert financial report', error)
    return NextResponse.json({ error: 'Failed to upsert financial report' }, { status: 500 })
  }
}
