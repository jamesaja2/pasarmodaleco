import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const [participantsTotal, participantsActive] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.PARTICIPANT } }),
      prisma.user.count({ where: { role: UserRole.PARTICIPANT, isActive: true } }),
    ])

    const dayControl = await prisma.dayControl.findFirst()

    const [transactionsTotal, transactionsVolume, transactionsByDay, stockPopularityRaw] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        _sum: { totalAmount: true },
      }),
      prisma.transaction.groupBy({
        by: ['dayNumber'],
        _count: { _all: true },
        _sum: { totalAmount: true },
        orderBy: { dayNumber: 'asc' },
        take: 30,
      }),
      prisma.transaction.groupBy({
        by: ['companyId'],
        _count: { _all: true },
      }),
    ])

    const currentDay = dayControl?.currentDay ?? 0
    const totalDays = dayControl?.totalDays ?? 0
    const isSimulationActive = dayControl?.isSimulationActive ?? false

    const todayCount = currentDay
      ? await prisma.transaction.count({ where: { dayNumber: currentDay } })
      : 0

    const stockPopularity = stockPopularityRaw
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 10)

    const companyIds = stockPopularity.map((item) => item.companyId)
    const companies = companyIds.length
      ? await prisma.company.findMany({ where: { id: { in: companyIds } } })
      : []

    const participantsSummary = {
      total: participantsTotal,
      active: participantsActive,
    }

    const totalVolume = Number(transactionsVolume._sum.totalAmount ?? 0)

    const transactionsSummary = {
      total: transactionsTotal,
      today: todayCount,
      volume: totalVolume,
    }

    const transactionsTrend = transactionsByDay.map((item) => ({
      dayNumber: item.dayNumber,
      count: item._count._all,
      volume: Number(item._sum.totalAmount ?? 0),
    }))

    const popularity = stockPopularity.map((item) => {
      const company = companies.find((c) => c.id === item.companyId)
      return {
        companyId: item.companyId,
        stockCode: company?.stockCode ?? 'UNKNOWN',
        companyName: company?.companyName ?? 'Tidak diketahui',
        transactions: item._count._all,
      }
    })

    return NextResponse.json({
      participants: participantsSummary,
      transactions: transactionsSummary,
      simulation: {
        currentDay,
        totalDays,
        isSimulationActive,
      },
      charts: {
        transactionsByDay: transactionsTrend,
        stockPopularity: popularity,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch admin overview', error)
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 })
  }
}
