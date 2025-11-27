import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'

const updateSchema = z.object({
  brokerName: z.string().trim().min(3).optional(),
  feePercentage: z.number().min(0).max(5).optional(),
  interestRate: z.number().min(0).max(10).optional(),
  description: z.string().trim().max(500).optional().nullable(),
})

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const json = await request.json()
    const payload = updateSchema.parse(json)
    const { id } = await context.params

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 })
    }

    const broker = await prisma.broker.update({
      where: { id },
      data: {
        brokerName: payload.brokerName,
        feePercentage: payload.feePercentage !== undefined ? new Prisma.Decimal(payload.feePercentage) : undefined,
        interestRate: payload.interestRate !== undefined ? new Prisma.Decimal(payload.interestRate) : undefined,
        description: payload.description !== undefined ? (payload.description?.trim() || null) : undefined,
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
    })
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
    console.error('Failed to update broker', error)
    return NextResponse.json({ error: 'Failed to update broker' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await context.params
    const broker = await prisma.broker.findUnique({
      where: { id },
      include: { users: { select: { id: true }, take: 1 }, transactions: { select: { id: true }, take: 1 } },
    })

    if (!broker) {
      return NextResponse.json({ error: 'Broker tidak ditemukan' }, { status: 404 })
    }

    if ((broker.users?.length ?? 0) > 0 || (broker.transactions?.length ?? 0) > 0) {
      return NextResponse.json({ error: 'Broker sedang digunakan dan tidak dapat dihapus' }, { status: 400 })
    }

    await prisma.broker.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to delete broker', error)
    return NextResponse.json({ error: 'Failed to delete broker' }, { status: 500 })
  }
}
