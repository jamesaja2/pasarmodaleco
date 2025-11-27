import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

const querySchema = z.object({
  day: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const { searchParams } = new URL(request.url)

    const parsed = querySchema.safeParse({
      day: searchParams.get('day') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { day, limit = 50, offset = 0 } = parsed.data

    const where = {
      userId: user.id,
      ...(day !== undefined ? { dayNumber: day } : {}),
    }

    type TransactionWithRelations = Prisma.TransactionGetPayload<{
      include: { company: true; broker: true }
    }>

    const [total, itemsRaw] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: {
          company: true,
          broker: true,
        },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
    ])

    const items = itemsRaw as TransactionWithRelations[]

    const transactions = items.map((item) => ({
      id: item.id,
      dayNumber: item.dayNumber,
      stockCode: item.company.stockCode,
      transactionType: item.transactionType,
      quantity: item.quantity,
      pricePerShare: Number(item.pricePerShare),
      totalAmount: Number(item.totalAmount),
      balanceBefore: Number(item.balanceBefore),
      balanceAfter: Number(item.balanceAfter),
      brokerFee: Number(item.brokerFee),
      timestamp: item.timestamp,
      status: item.status,
      broker: {
        code: item.broker.brokerCode,
        name: item.broker.brokerName,
        feePercentage: Number(item.broker.feePercentage),
      },
    }))

    const payload = {
      total,
      transactions,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch transaction history', error)
    return NextResponse.json({ error: 'Failed to fetch transaction history' }, { status: 500 })
  }
}
