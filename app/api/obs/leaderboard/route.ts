import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CACHE_KEYS, getCache } from '@/lib/cache'
import type { Prisma } from '@prisma/client'

const DEFAULT_LIMIT = 10

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)

    const cache = await getCache()
    const cached = await cache.get<{ leaderboard: any[]; total: number }>(CACHE_KEYS.LEADERBOARD)
    if (cached) {
      return NextResponse.json({ ...cached, timestamp: new Date().toISOString() })
    }

    const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    const currentDay = dayControl?.currentDay ?? 0

    const participants = await prisma.user.findMany({
      where: {
        role: 'PARTICIPANT',
        isActive: true,
      },
      include: {
        portfolio: {
          include: {
            company: true,
          },
        },
      },
    })

    type PriceLookup = Prisma.StockPriceGetPayload<{}>

    const companyIds = Array.from(new Set(participants.flatMap((participant) => participant.portfolio.map((holding) => holding.companyId))))

    const priceRecords: PriceLookup[] = companyIds.length
      ? await prisma.stockPrice.findMany({
          where: {
            companyId: { in: companyIds },
            dayNumber: { lte: currentDay },
          },
          orderBy: [{ companyId: 'asc' }, { dayNumber: 'desc' }],
        })
      : []

    const latestPriceMap = new Map<string, PriceLookup>()
    for (const record of priceRecords) {
      if (!latestPriceMap.has(record.companyId)) {
        latestPriceMap.set(record.companyId, record)
      }
    }

    const leaderboard = participants
      .map((participant) => {
        const cash = Number(participant.currentBalance)
        const starting = Number(participant.startingBalance)
        const holdingsValue = participant.portfolio.reduce((sum, holding) => {
          const price = latestPriceMap.get(holding.companyId)
          const priceValue = price ? Number(price.price) : 0
          return sum + holding.quantity * priceValue
        }, 0)

        const totalValue = cash + holdingsValue
        const totalReturn = totalValue - starting
        const returnPercentage = starting > 0 ? (totalReturn / starting) * 100 : 0

        return {
          teamName: participant.teamName ?? participant.username,
          school: participant.schoolOrigin ?? '-',
          portfolioValue: Number(totalValue.toFixed(2)),
          returnPercentage: Number(returnPercentage.toFixed(2)),
        }
      })
      .sort((a, b) => b.portfolioValue - a.portfolioValue)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }))

    const payload = {
      leaderboard: leaderboard.slice(0, limit),
      total: leaderboard.length,
    }

    await cache.set(CACHE_KEYS.LEADERBOARD, payload, 300)

    return NextResponse.json({ ...payload, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Failed to fetch obs leaderboard', error)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
