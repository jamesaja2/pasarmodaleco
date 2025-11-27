import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const { id } = await params

    const news = await prisma.news.findUnique({
      where: { id },
      include: {
        company: true,
        purchases: user.role === 'PARTICIPANT' ? { where: { userId: user.id } } : false,
      },
    })

    if (!news) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 })
    }

    // For participants: check if simulation is active and news is available for current day
    if (user.role === 'PARTICIPANT') {
      const dayControl = await prisma.dayControl.findUnique({
        where: { id: 'day-control-singleton' },
      })
      const currentDay = dayControl?.currentDay ?? 0
      const isSimulationActive = dayControl?.isSimulationActive ?? false

      if (!isSimulationActive || news.dayNumber > currentDay) {
        return NextResponse.json({ error: 'News not available yet' }, { status: 403 })
      }
    }

    const isPurchased =
      user.role === 'ADMIN' ? true : Array.isArray(news.purchases) && news.purchases.length > 0

    if (news.isPaid && !isPurchased) {
      return NextResponse.json({
        id: news.id,
        title: news.title,
        dayNumber: news.dayNumber,
        isPaid: news.isPaid,
        price: news.price ? Number(news.price) : null,
        companyCode: news.company?.stockCode ?? null,
        publishedAt: news.publishedAt,
        isPurchased: false,
        preview: news.content.slice(0, 160) + (news.content.length > 160 ? '...' : ''),
      })
    }

    return NextResponse.json({
      id: news.id,
      title: news.title,
      content: news.content,
      dayNumber: news.dayNumber,
      isPaid: news.isPaid,
      price: news.price ? Number(news.price) : null,
      companyCode: news.company?.stockCode ?? null,
      publishedAt: news.publishedAt,
      isPurchased: true,
    })
  } catch (error) {
    console.error('Failed to fetch news detail', error)
    return NextResponse.json({ error: 'Failed to fetch news detail' }, { status: 500 })
  }
}
