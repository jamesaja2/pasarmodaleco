import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { broadcastNotification } from '@/lib/realtime-server'
import { Prisma } from '@prisma/client'

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)

    if (user.role !== 'PARTICIPANT') {
      return NextResponse.json({ error: 'Only participants can purchase news' }, { status: 403 })
    }

    // Get current simulation day
    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0
    const isSimulationActive = dayControl?.isSimulationActive ?? false

    if (!isSimulationActive) {
      return NextResponse.json({ error: 'Simulation not active' }, { status: 403 })
    }

    // Get settings
    const [maxPaidNewsSetting, paidNewsPriceSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'max_paid_news_per_day' } }),
      prisma.setting.findUnique({ where: { key: 'paid_news_price' } }),
    ])

    const maxPaidNewsPerDay = toNumber(maxPaidNewsSetting?.value ?? 5)
    const paidNewsPrice = toNumber(paidNewsPriceSetting?.value ?? 500000)

    // Count how many paid news user has purchased today
    const purchasedToday = await prisma.userNewsPurchase.count({
      where: {
        userId: user.id,
        news: {
          dayNumber: currentDay,
          isPaid: true,
        },
      },
    })

    if (purchasedToday >= maxPaidNewsPerDay) {
      return NextResponse.json({ 
        error: `Anda sudah mencapai batas maksimal ${maxPaidNewsPerDay} berita berbayar untuk hari ini` 
      }, { status: 400 })
    }

    // Check balance
    if (Number(user.currentBalance) < paidNewsPrice) {
      return NextResponse.json({ error: 'Saldo tidak mencukupi' }, { status: 400 })
    }

    // Get all paid news for current day that user hasn't purchased
    const availablePaidNews = await prisma.news.findMany({
      where: {
        dayNumber: currentDay,
        isPaid: true,
        NOT: {
          purchases: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    })

    if (availablePaidNews.length === 0) {
      return NextResponse.json({ 
        error: 'Tidak ada berita berbayar tersedia untuk hari ini' 
      }, { status: 400 })
    }

    // Pick random news
    const randomIndex = Math.floor(Math.random() * availablePaidNews.length)
    const selectedNews = availablePaidNews[randomIndex]

    const balanceAfter = Number(user.currentBalance) - paidNewsPrice

    // Process purchase
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
          newsId: selectedNews.id,
          pricePaid: paidNewsPrice,
        },
      })
    })

    broadcastNotification({
      type: 'success',
      title: 'Berita berhasil dibeli',
      message: `${selectedNews.title}`,
    })

    return NextResponse.json({
      success: true,
      balanceAfter,
      remainingPurchases: maxPaidNewsPerDay - purchasedToday - 1,
      news: {
        id: selectedNews.id,
        title: selectedNews.title,
        content: selectedNews.content,
        dayNumber: selectedNews.dayNumber,
      },
    })
  } catch (error) {
    console.error('Failed to purchase random news', error)
    return NextResponse.json({ error: 'Gagal membeli berita' }, { status: 500 })
  }
}

// GET - Check how many paid news can still be purchased today
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    if (user.role !== 'PARTICIPANT') {
      return NextResponse.json({ error: 'Only participants' }, { status: 403 })
    }

    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0
    const isSimulationActive = dayControl?.isSimulationActive ?? false

    const [maxPaidNewsSetting, paidNewsPriceSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'max_paid_news_per_day' } }),
      prisma.setting.findUnique({ where: { key: 'paid_news_price' } }),
    ])

    const maxPaidNewsPerDay = toNumber(maxPaidNewsSetting?.value ?? 5)
    const paidNewsPrice = toNumber(paidNewsPriceSetting?.value ?? 500000)

    // Count purchases for today
    const purchasedToday = await prisma.userNewsPurchase.count({
      where: {
        userId: user.id,
        news: {
          dayNumber: currentDay,
          isPaid: true,
        },
      },
    })

    // Count available paid news for today
    const availableCount = await prisma.news.count({
      where: {
        dayNumber: currentDay,
        isPaid: true,
        NOT: {
          purchases: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    })

    return NextResponse.json({
      currentDay,
      isSimulationActive,
      maxPaidNewsPerDay,
      paidNewsPrice,
      purchasedToday,
      remainingPurchases: Math.max(0, maxPaidNewsPerDay - purchasedToday),
      availableNews: availableCount,
    })
  } catch (error) {
    console.error('Failed to get paid news status', error)
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}
