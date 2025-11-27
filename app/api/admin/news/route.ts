import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

const newsSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  dayNumber: z.number().int().min(0),
  isPaid: z.boolean(),
  price: z.number().nonnegative().optional(),
  companyId: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    type NewsWithCompany = Prisma.NewsGetPayload<{ include: { company: true } }>

    const newsRaw = await prisma.news.findMany({
      orderBy: { publishedAt: 'desc' },
      include: { company: true },
    })

    const news = newsRaw as NewsWithCompany[]

    const payload = news.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      dayNumber: item.dayNumber,
      isPaid: item.isPaid,
      price: item.price ? Number(item.price) : null,
      company: item.company
        ? { id: item.company.id, stockCode: item.company.stockCode, name: item.company.companyName }
        : null,
      publishedAt: item.publishedAt?.toISOString?.() ?? item.publishedAt,
    }))

    return NextResponse.json({
      news: payload,
      total: news.length,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch admin news', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = newsSchema.parse(body)

    const news = await prisma.news.create({
      data: {
        title: data.title,
        content: data.content,
        dayNumber: data.dayNumber,
        isPaid: data.isPaid,
        price: data.isPaid ? data.price ?? 0 : null,
        companyId: data.companyId ?? null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      },
    })

    return NextResponse.json({ success: true, news })
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
    console.error('Failed to create news', error)
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 })
  }
}
