import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const querySchema = z.object({
  username: z.string().optional(),
  stock: z.string().optional(),
  type: z.enum(['BUY', 'SELL']).optional(),
  day: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = request.nextUrl
    const rawQuery = Object.fromEntries(searchParams.entries()) as Record<string, string>
    const parsedQuery = querySchema.safeParse(rawQuery)

    if (!parsedQuery.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { username, stock, type, day, limit } = parsedQuery.data

    const where: Prisma.TransactionWhereInput = {}

    if (username) {
      where.user = { username: { contains: username, mode: 'insensitive' } }
    }

    if (stock) {
      where.company = { stockCode: { contains: stock, mode: 'insensitive' } }
    }

    if (type) {
      where.transactionType = type as Prisma.TransactionWhereInput['transactionType']
    }

    if (day !== undefined) {
      where.dayNumber = day
    }

    const take = limit ?? 200

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take,
      include: {
        user: true,
        broker: true,
        company: true,
      },
    })

    const total = await prisma.transaction.count({ where })

    const payload = transactions.map((tx) => ({
      id: tx.id,
      username: tx.user.username,
      teamName: tx.user.teamName ?? '',
      broker: {
        id: tx.brokerId,
        code: tx.broker.brokerCode,
        name: tx.broker.brokerName,
      },
      company: {
        id: tx.companyId,
        stockCode: tx.company.stockCode,
        name: tx.company.companyName,
      },
      dayNumber: tx.dayNumber,
      type: tx.transactionType,
      quantity: tx.quantity,
      pricePerShare: Number(tx.pricePerShare),
      totalAmount: Number(tx.totalAmount),
      brokerFee: Number(tx.brokerFee),
      timestamp: tx.timestamp,
      status: tx.status,
    }))

    return NextResponse.json({ transactions: payload, total })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch admin transactions', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
