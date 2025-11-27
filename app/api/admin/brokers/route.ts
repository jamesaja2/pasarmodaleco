import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'

const createSchema = z.object({
  brokerCode: z.string().trim().min(2).max(5),
  brokerName: z.string().trim().min(3),
  feePercentage: z.number().min(0).max(5),
  interestRate: z.number().min(0).max(10).optional().default(0),
  description: z.string().trim().max(500).optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const brokers = await prisma.broker.findMany({
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      brokers: brokers.map((broker) => ({
        id: broker.id,
        code: broker.brokerCode,
        name: broker.brokerName,
        fee: Number(broker.feePercentage),
        interestRate: Number(broker.interestRate),
        description: broker.description ?? '',
        createdAt: broker.createdAt,
        updatedAt: broker.updatedAt,
        isActive: broker.isActive,
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch brokers', error)
    return NextResponse.json({ error: 'Failed to fetch brokers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const json = await request.json()
    const payload = createSchema.parse(json)

    const { brokerCode, brokerName, feePercentage, interestRate, description } = payload

    const existing = await prisma.broker.findUnique({ where: { brokerCode: brokerCode.toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Kode broker sudah digunakan' }, { status: 409 })
    }

    const broker = await prisma.broker.create({
      data: {
        brokerCode: brokerCode.toUpperCase(),
        brokerName,
        feePercentage: new Prisma.Decimal(feePercentage),
        interestRate: new Prisma.Decimal(interestRate ?? 0),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json({
      success: true,
      broker: {
        id: broker.id,
        code: broker.brokerCode,
        name: broker.brokerName,
        fee: Number(broker.feePercentage),
        interestRate: Number(broker.interestRate),
        description: broker.description ?? '',
        createdAt: broker.createdAt,
        updatedAt: broker.updatedAt,
        isActive: broker.isActive,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to create broker', error)
    return NextResponse.json({ error: 'Failed to create broker' }, { status: 500 })
  }
}
