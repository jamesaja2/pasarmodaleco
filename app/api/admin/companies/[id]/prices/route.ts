import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getCache, CACHE_KEYS } from '@/lib/cache'

const schema = z.object({
  dayNumber: z.number().int().min(0).max(365),
  price: z.number().positive(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await context.params

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, stockCode: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const prices = await prisma.stockPrice.findMany({
      where: { companyId: company.id },
      orderBy: { dayNumber: 'asc' },
    })

    return NextResponse.json({
      company: {
        id: company.id,
        stockCode: company.stockCode,
      },
      prices: prices.map((price) => ({
        id: price.id,
        dayNumber: price.dayNumber,
        price: Number(price.price),
        isActive: price.isActive,
        createdAt: price.createdAt,
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch stock prices', error)
    return NextResponse.json({ error: 'Failed to fetch stock prices' }, { status: 500 })
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

    const price = await prisma.stockPrice.upsert({
      where: {
        companyId_dayNumber: {
          companyId: company.id,
          dayNumber: data.dayNumber,
        },
      },
      update: {
        price: data.price,
        isActive: data.isActive ?? true,
      },
      create: {
        companyId: company.id,
        dayNumber: data.dayNumber,
        price: data.price,
        isActive: data.isActive ?? true,
      },
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.STOCK_PRICES(data.dayNumber))

    return NextResponse.json({ success: true, price })
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
    console.error('Failed to upsert stock price', error)
    return NextResponse.json({ error: 'Failed to upsert stock price' }, { status: 500 })
  }
}
