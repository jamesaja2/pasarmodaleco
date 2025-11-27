import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { broadcastNotification } from '@/lib/realtime-server'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request)
    const { id } = await params

    if (user.role !== 'PARTICIPANT') {
      return NextResponse.json({ error: 'Only participants can purchase news' }, { status: 403 })
    }

    const news = await prisma.news.findUnique({ where: { id } })
    if (!news) {
      return NextResponse.json({ error: 'News not found' }, { status: 404 })
    }

    // Check if simulation is active and news is available for current day
    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0
    const isSimulationActive = dayControl?.isSimulationActive ?? false

    if (!isSimulationActive || news.dayNumber > currentDay) {
      return NextResponse.json({ error: 'News not available yet' }, { status: 403 })
    }

    if (!news.isPaid) {
      return NextResponse.json({ error: 'News is already free' }, { status: 400 })
    }

    const price = news.price ? Number(news.price) : 0
    if (price <= 0) {
      return NextResponse.json({ error: 'Invalid news price' }, { status: 400 })
    }

    const alreadyPurchased = await prisma.userNewsPurchase.findUnique({
      where: {
        userId_newsId: {
          userId: user.id,
          newsId: news.id,
        },
      },
    })

    if (alreadyPurchased) {
      return NextResponse.json({ error: 'News already purchased' }, { status: 400 })
    }

    if (Number(user.currentBalance) < price) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    const balanceAfter = Number(user.currentBalance) - price

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          currentBalance: balanceAfter.toFixed(2),
        },
      })

      await tx.userNewsPurchase.create({
        data: {
          userId: user.id,
          newsId: news.id,
          pricePaid: price,
        },
      })
    })

    broadcastNotification({
      type: 'success',
      title: 'News purchased',
      message: `${news.title} berhasil dibeli`,
    })

    return NextResponse.json({
      success: true,
      balanceAfter,
      news: {
        id: news.id,
        title: news.title,
        content: news.content,
        dayNumber: news.dayNumber,
      },
    })
  } catch (error) {
    console.error('Failed to purchase news', error)
    return NextResponse.json({ error: 'Failed to purchase news' }, { status: 500 })
  }
}
