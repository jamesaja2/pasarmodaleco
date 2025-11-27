import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { TransactionStatus, Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    const currentDay = dayControl?.currentDay ?? 0

    type TransactionWithCompany = Prisma.TransactionGetPayload<{
      include: { company: true }
    }>

    const transactionsRaw = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        dayNumber: currentDay,
      },
      include: {
        company: true,
      },
      orderBy: { timestamp: 'desc' },
    })

    const transactions = transactionsRaw as TransactionWithCompany[]

    const completed = transactions.filter((tx) => tx.status === TransactionStatus.COMPLETED)

    const summary = completed.length
      ? {
          dayNumber: currentDay,
          totalTransactions: completed.length,
          buys: completed
            .filter((tx) => tx.transactionType === 'BUY')
            .map((tx) => ({
              stockCode: tx.company.stockCode,
              quantity: tx.quantity,
              price: Number(tx.pricePerShare),
              total: Number(tx.totalAmount),
            })),
          sells: completed
            .filter((tx) => tx.transactionType === 'SELL')
            .map((tx) => ({
              stockCode: tx.company.stockCode,
              quantity: tx.quantity,
              price: Number(tx.pricePerShare),
              total: Number(tx.totalAmount),
            })),
          brokerFee: completed.length ? Number(completed[0].brokerFee) : 0,
          balanceAfter: completed.length ? Number(completed[0].balanceAfter) : Number(user.currentBalance),
        }
      : null

    return NextResponse.json({
      hasTransaction: completed.length > 0,
      summary,
    })
  } catch (error) {
    console.error('Failed to fetch todays transaction', error)
    return NextResponse.json({ error: 'Failed to fetch todays transaction' }, { status: 500 })
  }
}
