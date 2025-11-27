import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { CACHE_KEYS, getCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    const cache = await getCache()
    const cacheKey = CACHE_KEYS.USER_PORTFOLIO(user.id)
    const cached = await cache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    const currentDay = dayControl?.currentDay ?? 0

    const holdings = await prisma.portfolioHolding.findMany({
      where: { userId: user.id },
      include: { company: true },
      orderBy: { company: { stockCode: 'asc' } },
    })

    const enriched = await Promise.all(
      holdings.map(async (holding) => {
        const priceRecord = await prisma.stockPrice.findFirst({
          where: {
            companyId: holding.companyId,
            dayNumber: { lte: currentDay },
          },
          orderBy: { dayNumber: 'desc' },
        })

        const currentPrice = priceRecord ? Number(priceRecord.price) : 0
        const totalEquity = currentPrice * holding.quantity
        const avgBuy = Number(holding.averageBuyPrice)
        const profitLoss = (currentPrice - avgBuy) * holding.quantity

        return {
          id: holding.id,
          stockCode: holding.company.stockCode,
          companyName: holding.company.companyName,
          quantity: holding.quantity,
          averageBuyPrice: avgBuy,
          currentPrice,
          totalEquity,
          profitLoss,
        }
      })
    )

    const totalInvestment = enriched.reduce((sum, h) => sum + h.totalEquity, 0)
    const cashBalance = Number(user.currentBalance)
    const totalPortfolioValue = totalInvestment + cashBalance
    const startingBalance = Number(user.startingBalance)
    const totalReturn = totalPortfolioValue - startingBalance
    const returnPercentage = startingBalance > 0 ? (totalReturn / startingBalance) * 100 : 0

    const payload = {
      holdings: enriched,
      summary: {
        cashBalance,
        totalInvestmentValue: totalInvestment,
        totalPortfolioValue,
        totalReturn,
        returnPercentage: Number(returnPercentage.toFixed(2)),
      },
    }

    await cache.set(cacheKey, payload, 60)

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch portfolio', error)
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 })
  }
}
