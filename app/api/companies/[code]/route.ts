import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireUser(request)
    const { code } = await params
    const stockCode = code.toUpperCase()

    const company = await prisma.company.findUnique({
      where: { stockCode },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0

    const prices = await prisma.stockPrice.findMany({
      where: {
        companyId: company.id,
        OR: [{ isActive: true }, { dayNumber: { lte: currentDay } }],
      },
      orderBy: { dayNumber: 'asc' },
    })

    const reports = await prisma.financialReport.findMany({
      where: {
        companyId: company.id,
        isAvailable: true,
        dayNumber: { lte: currentDay },
      },
      orderBy: { dayNumber: 'asc' },
    })

    const news = await prisma.news.findMany({
      where: {
        companyId: company.id,
        dayNumber: { lte: currentDay },
      },
      include:
        user.role === 'PARTICIPANT'
          ? {
              purchases: {
                where: { userId: user.id },
                select: { id: true },
              },
            }
          : undefined,
      orderBy: { dayNumber: 'desc' },
    })

    return NextResponse.json({
      company: {
        id: company.id,
        stockCode: company.stockCode,
        name: company.companyName,
        sector: company.sector,
        description: company.description,
        location: company.location,
        logoUrl: company.logoUrl,
        sellingPrice: company.sellingPrice,
        sharesOutstanding: company.sharesOutstanding ? Number(company.sharesOutstanding) : null,
      },
      currentDay,
      prices: prices.map((price) => ({
        id: price.id,
        dayNumber: price.dayNumber,
        price: Number(price.price),
        isActive: price.isActive,
      })),
      reports: reports.map((report) => ({
        id: report.id,
        dayNumber: report.dayNumber,
        summary: report.reportContent,
        pdfUrl: report.pdfUrl,
        isAvailable: report.isAvailable,
        updatedAt: report.updatedAt,
      })),
      news: news.map((item) => {
        // Type assertion for conditional include
        const purchases = 'purchases' in item ? (item as any).purchases : undefined
        const hasAccess =
          !item.isPaid ||
          user.role === 'ADMIN' ||
          (Array.isArray(purchases) && purchases.length > 0)

        return {
          id: item.id,
          // Hide title for paid news that user hasn't purchased (except admin)
          title: hasAccess ? item.title : 'Berita Berbayar',
          content: hasAccess ? item.content : null,
          dayNumber: item.dayNumber,
          isPaid: item.isPaid,
          price: item.price ? Number(item.price) : null,
          publishedAt: item.publishedAt,
          canRead: hasAccess,
        }
      }),
    })
  } catch (error) {
    console.error('Failed to fetch company detail', error)
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to fetch company detail' }, { status: 500 })
  }
}
