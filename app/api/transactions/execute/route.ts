import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { getCache, CACHE_KEYS } from '@/lib/cache'
import { broadcastNotification, broadcastTransactionStatus } from '@/lib/realtime-server'
import Decimal from 'decimal.js'

const transactionSchema = z.object({
  transactions: z
    .array(
      z.object({
        stockCode: z.string().min(3).max(5),
        type: z.enum(['BUY', 'SELL']),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)

    if (user.role !== 'PARTICIPANT') {
      return NextResponse.json({ error: 'Only participants can execute transactions' }, { status: 403 })
    }

    if (!user.brokerId) {
      return NextResponse.json({ error: 'Broker belum ditetapkan. Pilih broker terlebih dahulu.' }, { status: 400 })
    }

    const body = await request.json()
    const { transactions } = transactionSchema.parse(body)

    const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    if (!dayControl || !dayControl.isSimulationActive) {
      return NextResponse.json({ error: 'Simulation is not active' }, { status: 400 })
    }

    const currentDay = dayControl.currentDay
    if (currentDay <= 0) {
      return NextResponse.json({ error: 'Simulation day has not started' }, { status: 400 })
    }

    // Block transactions on the last day (day 15 or totalDays)
    if (currentDay >= dayControl.totalDays) {
      return NextResponse.json({ 
        error: 'Transaksi ditutup. Simulasi telah mencapai hari terakhir.',
        day: currentDay,
        totalDays: dayControl.totalDays 
      }, { status: 400 })
    }

    const existingTransactions = await prisma.transaction.count({
      where: {
        userId: user.id,
        dayNumber: currentDay,
        status: TransactionStatus.COMPLETED,
      },
    })

    if (existingTransactions > 0) {
      return NextResponse.json({ error: 'Daily transaction already completed' }, { status: 409 })
    }

    const stockCodes = [...new Set(transactions.map((tx) => tx.stockCode.toUpperCase()))]
    const companies = await prisma.company.findMany({
      where: { stockCode: { in: stockCodes } },
    })

    if (companies.length !== stockCodes.length) {
      return NextResponse.json({ error: 'One or more stock codes are invalid' }, { status: 400 })
    }

    const prices = await prisma.stockPrice.findMany({
      where: {
        company: { stockCode: { in: stockCodes } },
        dayNumber: currentDay,
      },
    })

    const priceMap = new Map<string, (typeof prices)[number]>()
    prices.forEach((price) => {
      priceMap.set(price.companyId, price)
    })

    const companyMap = new Map(companies.map((company) => [company.stockCode, company]))

    const holdings = await prisma.portfolioHolding.findMany({
      where: {
        userId: user.id,
        companyId: { in: companies.map((c) => c.id) },
      },
    })
    const holdingMap = new Map(holdings.map((holding) => [holding.companyId, holding]))

    let totalBuy = new Decimal(0)
    let totalSell = new Decimal(0)
    const buySummary: Array<{ stockCode: string; quantity: number; price: number; total: number }> = []
    const sellSummary: Array<{ stockCode: string; quantity: number; price: number; total: number }> = []

    for (const tx of transactions) {
      const company = companyMap.get(tx.stockCode.toUpperCase())!
      const priceRecord = priceMap.get(company.id)
      if (!priceRecord || !priceRecord.isActive) {
        return NextResponse.json({ error: `Price for ${tx.stockCode} is not available for day ${currentDay}` }, { status: 400 })
      }

      const price = new Decimal(priceRecord.price.toString())
      const amount = price.mul(tx.quantity)

      if (tx.type === 'BUY') {
        totalBuy = totalBuy.plus(amount)
        buySummary.push({
          stockCode: tx.stockCode.toUpperCase(),
          quantity: tx.quantity,
          price: Number(price.toNumber()),
          total: Number(amount.toNumber()),
        })
      } else {
        const holding = holdingMap.get(company.id)
        if (!holding || holding.quantity < tx.quantity) {
          return NextResponse.json({ error: `Insufficient shares to sell for ${tx.stockCode}` }, { status: 400 })
        }
        totalSell = totalSell.plus(amount)
        sellSummary.push({
          stockCode: tx.stockCode.toUpperCase(),
          quantity: tx.quantity,
          price: Number(price.toNumber()),
          total: Number(amount.toNumber()),
        })
      }
    }

    const brokerRecord = user.broker ?? (await prisma.broker.findUnique({ where: { id: user.brokerId } }))
    if (!brokerRecord) {
      return NextResponse.json({ error: 'Broker tidak ditemukan' }, { status: 400 })
    }

    const brokerFeePercent = new Decimal(brokerRecord.feePercentage.toString())
    const brokerFee = totalBuy.plus(totalSell).mul(brokerFeePercent).div(100)
    const startingBalance = new Decimal(user.currentBalance.toString())
    const endingBalance = startingBalance.minus(totalBuy).plus(totalSell).minus(brokerFee)

    if (endingBalance.isNegative()) {
      return NextResponse.json({
        error: 'Insufficient balance',
        requiredBalance: Number(totalBuy.plus(brokerFee).toNumber()),
        availableBalance: Number(startingBalance.toNumber()),
      }, { status: 400 })
    }

    const cache = await getCache()

    await prisma.$transaction(async (txClient: Prisma.TransactionClient) => {
      // Update balance
      await txClient.user.update({
        where: { id: user.id },
        data: { currentBalance: endingBalance.toFixed(2) },
      })

      for (const txItem of transactions) {
        const company = companyMap.get(txItem.stockCode.toUpperCase())!
        const priceRecord = priceMap.get(company.id)!
        const price = new Decimal(priceRecord.price.toString())
        const amount = price.mul(txItem.quantity)

        const holding = holdingMap.get(company.id)

        if (txItem.type === 'BUY') {
          const newQuantity = (holding?.quantity ?? 0) + txItem.quantity
          const prevValue = holding ? new Decimal(holding.averageBuyPrice.toString()).mul(holding.quantity) : new Decimal(0)
          const newValue = prevValue.plus(amount)
          const newAverage = newQuantity > 0 ? newValue.div(newQuantity) : new Decimal(0)

          if (holding) {
            await txClient.portfolioHolding.update({
              where: { id: holding.id },
              data: {
                quantity: newQuantity,
                averageBuyPrice: newAverage.toFixed(2),
                lastUpdated: new Date(),
              },
            })
          } else {
            const created = await txClient.portfolioHolding.create({
              data: {
                userId: user.id,
                companyId: company.id,
                quantity: newQuantity,
                averageBuyPrice: newAverage.toFixed(2),
              },
            })
            holdingMap.set(company.id, { ...created })
          }
        } else {
          if (!holding) {
            throw new Error('Attempted to sell without holding')
          }
          const remainingQuantity = holding.quantity - txItem.quantity
          if (remainingQuantity < 0) {
            throw new Error('Sell quantity exceeds holding quantity')
          }
          if (remainingQuantity === 0) {
            await txClient.portfolioHolding.delete({ where: { id: holding.id } })
            holdingMap.delete(company.id)
          } else {
            await txClient.portfolioHolding.update({
              where: { id: holding.id },
              data: {
                quantity: remainingQuantity,
                lastUpdated: new Date(),
              },
            })
          }
        }

        await txClient.transaction.create({
          data: {
            userId: user.id,
            brokerId: user.brokerId,
            companyId: company.id,
            dayNumber: currentDay,
            transactionType: txItem.type as TransactionType,
            quantity: txItem.quantity,
            pricePerShare: price.toFixed(2),
            totalAmount: amount.toFixed(2),
            balanceBefore: startingBalance.toFixed(2),
            balanceAfter: endingBalance.toFixed(2),
            brokerFee: brokerFee.toFixed(2),
            status: TransactionStatus.COMPLETED,
          },
        })
      }
    })

    await cache.del(CACHE_KEYS.USER_PORTFOLIO(user.id))
    await cache.del(CACHE_KEYS.LEADERBOARD)

    broadcastTransactionStatus({
      userId: user.id,
      status: 'completed',
      message: `Transaksi hari ${currentDay} selesai`,
    })

    broadcastNotification({
      type: 'success',
      title: 'Transaksi Berhasil',
      message: `Transaksi hari ${currentDay} telah diproses untuk ${user.teamName ?? user.username}`,
    })

    const responsePayload = {
      success: true,
      summary: {
        startingBalance: Number(startingBalance.toNumber()),
        brokerFee: Number(brokerFee.toNumber()),
        endingBalance: Number(endingBalance.toNumber()),
        buys: buySummary,
        sells: sellSummary,
        totalInvestmentValue: buySummary.reduce((sum, item) => sum + item.total, 0),
        totalSellValue: sellSummary.reduce((sum, item) => sum + item.total, 0),
        day: currentDay,
      },
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('Failed to execute transaction', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    if (error instanceof Error && (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to execute transaction' }, { status: 500 })
  }
}
