import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

type MutationEntry = {
  id: string
  type: 'TRANSACTION_BUY' | 'TRANSACTION_SELL' | 'INTEREST' | 'NEWS_PURCHASE'
  dayNumber: number
  description: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  timestamp: string
  details?: {
    stockCode?: string
    quantity?: number
    pricePerShare?: number
    brokerFee?: number
    interestRate?: number
    portfolioValue?: number
    newsTitle?: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    if (user.role !== 'PARTICIPANT') {
      return NextResponse.json({ error: 'Only participants can view mutations' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dayParam = searchParams.get('day')
    const limitParam = searchParams.get('limit')
    const dayFilter = dayParam ? parseInt(dayParam, 10) : undefined
    const limit = limitParam ? parseInt(limitParam, 10) : 100

    // Fetch transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        ...(dayFilter !== undefined ? { dayNumber: dayFilter } : {}),
      },
      include: {
        company: {
          select: { stockCode: true, companyName: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    // Fetch interest payments
    const interestPayments = await prisma.interestPayment.findMany({
      where: {
        userId: user.id,
        ...(dayFilter !== undefined ? { dayNumber: dayFilter } : {}),
      },
      include: {
        broker: {
          select: { brokerCode: true, brokerName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Fetch news purchases
    const newsPurchases = await prisma.userNewsPurchase.findMany({
      where: {
        userId: user.id,
      },
      include: {
        news: {
          select: { id: true, title: true, dayNumber: true },
        },
      },
      orderBy: { purchasedAt: 'desc' },
      take: limit,
    })

    // Combine and format all mutations
    const mutations: MutationEntry[] = []

    // Add transactions
    for (const tx of transactions) {
      const isBuy = tx.transactionType === 'BUY'
      const amount = isBuy ? -Number(tx.totalAmount) - Number(tx.brokerFee) : Number(tx.totalAmount) - Number(tx.brokerFee)
      
      mutations.push({
        id: tx.id,
        type: isBuy ? 'TRANSACTION_BUY' : 'TRANSACTION_SELL',
        dayNumber: tx.dayNumber,
        description: `${isBuy ? 'Beli' : 'Jual'} ${tx.quantity} lot ${tx.company.stockCode}`,
        amount,
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        timestamp: tx.timestamp.toISOString(),
        details: {
          stockCode: tx.company.stockCode,
          quantity: tx.quantity,
          pricePerShare: Number(tx.pricePerShare),
          brokerFee: Number(tx.brokerFee),
        },
      })
    }

    // Add interest payments
    for (const interest of interestPayments) {
      mutations.push({
        id: interest.id,
        type: 'INTEREST',
        dayNumber: interest.dayNumber,
        description: `Bunga harian dari ${interest.broker.brokerCode} (${Number(interest.interestRate).toFixed(2)}%)`,
        amount: Number(interest.interestAmount),
        balanceBefore: Number(interest.balanceBefore),
        balanceAfter: Number(interest.balanceAfter),
        timestamp: interest.createdAt.toISOString(),
        details: {
          interestRate: Number(interest.interestRate),
          portfolioValue: Number(interest.portfolioValue),
        },
      })
    }

    // Add news purchases
    for (const purchase of newsPurchases) {
      mutations.push({
        id: purchase.id,
        type: 'NEWS_PURCHASE',
        dayNumber: purchase.news.dayNumber,
        description: `Beli berita: ${purchase.news.title.slice(0, 50)}${purchase.news.title.length > 50 ? '...' : ''}`,
        amount: -Number(purchase.pricePaid),
        balanceBefore: 0, // We don't track balance before/after for news purchases currently
        balanceAfter: 0,
        timestamp: purchase.purchasedAt.toISOString(),
        details: {
          newsTitle: purchase.news.title,
        },
      })
    }

    // Sort all mutations by timestamp descending
    mutations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Calculate summary
    const summary = {
      totalBuys: mutations.filter(m => m.type === 'TRANSACTION_BUY').reduce((sum, m) => sum + Math.abs(m.amount), 0),
      totalSells: mutations.filter(m => m.type === 'TRANSACTION_SELL').reduce((sum, m) => sum + m.amount, 0),
      totalInterest: mutations.filter(m => m.type === 'INTEREST').reduce((sum, m) => sum + m.amount, 0),
      totalNewsPurchases: mutations.filter(m => m.type === 'NEWS_PURCHASE').reduce((sum, m) => sum + Math.abs(m.amount), 0),
      transactionCount: mutations.filter(m => m.type === 'TRANSACTION_BUY' || m.type === 'TRANSACTION_SELL').length,
      interestCount: mutations.filter(m => m.type === 'INTEREST').length,
    }

    return NextResponse.json({
      mutations: mutations.slice(0, limit),
      summary,
      currentBalance: Number(user.currentBalance),
      startingBalance: Number(user.startingBalance),
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch mutations', error)
    return NextResponse.json({ error: 'Failed to fetch mutations' }, { status: 500 })
  }
}
