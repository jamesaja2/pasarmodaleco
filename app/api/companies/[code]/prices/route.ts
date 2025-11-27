import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireUser(request)

    const { code } = await params
    const stockCode = code.toUpperCase()
    const { searchParams } = new URL(request.url)
    const dayParam = searchParams.get('day')
    const dayNumber = dayParam ? Number(dayParam) : undefined

    const company = await prisma.company.findUnique({
      where: { stockCode },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (dayNumber !== undefined && Number.isNaN(dayNumber)) {
      return NextResponse.json({ error: 'Invalid day parameter' }, { status: 400 })
    }

    if (dayNumber !== undefined) {
      const price = await prisma.stockPrice.findUnique({
        where: {
          companyId_dayNumber: {
            companyId: company.id,
            dayNumber,
          },
        },
      })

      return NextResponse.json({
        stockCode,
        dayNumber,
        price: price ? Number(price.price) : null,
        isActive: price?.isActive ?? false,
      })
    }

    const prices = await prisma.stockPrice.findMany({
      where: { companyId: company.id },
      orderBy: { dayNumber: 'asc' },
    })

    return NextResponse.json({
      stockCode,
      prices: prices.map((p) => ({
        dayNumber: p.dayNumber,
        price: Number(p.price),
        isActive: p.isActive,
      })),
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('Failed to fetch prices', error)
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}
