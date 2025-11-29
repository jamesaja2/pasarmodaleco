import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getCache, CACHE_KEYS } from '@/lib/cache'

const updateSchema = z.object({
  companyName: z.string().min(3).optional(),
  sector: z.string().min(3).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  sellingPrice: z.string().optional().nullable(),
  sharesOutstanding: z.number().int().positive().optional().nullable(),
})

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = updateSchema.parse(body)
    const { id } = await context.params

    const company = await prisma.company.update({
      where: { id },
      data,
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.COMPANIES)

    return NextResponse.json({ success: true, company })
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
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    console.error('Failed to update company', error)
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await context.params
    const company = await prisma.company.findUnique({ where: { id } })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const [transactionCount, holdingCount] = await Promise.all([
      prisma.transaction.count({ where: { companyId: id } }),
      prisma.portfolioHolding.count({ where: { companyId: id } }),
    ])

    if (transactionCount > 0 || holdingCount > 0) {
      return NextResponse.json(
        {
          error:
            'Perusahaan tidak dapat dihapus karena masih memiliki transaksi atau kepemilikan portofolio. Reset atau hapus data terkait terlebih dahulu.',
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockPrice.deleteMany({ where: { companyId: id } })
      await tx.financialReport.deleteMany({ where: { companyId: id } })
      await tx.news.deleteMany({ where: { companyId: id } })
      await tx.company.delete({ where: { id } })
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.COMPANIES)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to delete company', error)
    return NextResponse.json({ error: 'Failed to delete company' }, { status: 500 })
  }
}
