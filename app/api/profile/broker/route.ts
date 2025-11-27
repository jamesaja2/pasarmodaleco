import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

const payloadSchema = z.object({
  brokerId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)

    if (user.role !== UserRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Hanya peserta yang dapat memilih broker' }, { status: 403 })
    }

    if (user.brokerId) {
      return NextResponse.json({ error: 'Broker sudah ditetapkan untuk akun ini' }, { status: 409 })
    }

    const body = await request.json()
    const data = payloadSchema.parse(body)

    const broker = await prisma.broker.findFirst({
      where: {
        id: data.brokerId,
        isActive: true,
      },
    })

    if (!broker) {
      return NextResponse.json({ error: 'Broker tidak ditemukan atau tidak aktif' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { broker: { connect: { id: broker.id } } },
      include: {
        broker: true,
      },
    } as any) as any

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        teamName: updatedUser.teamName,
        schoolOrigin: updatedUser.schoolOrigin,
        broker: {
          id: updatedUser.broker?.id ?? broker.id,
          code: updatedUser.broker?.brokerCode ?? broker.brokerCode,
          name: updatedUser.broker?.brokerName ?? broker.brokerName,
          feePercentage: Number(updatedUser.broker?.feePercentage ?? broker.feePercentage),
        },
        currentBalance: updatedUser.currentBalance,
        startingBalance: updatedUser.startingBalance,
        requiresBrokerSelection: false,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Payload tidak valid' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Failed to assign participant broker', error)
    return NextResponse.json({ error: 'Gagal menetapkan broker' }, { status: 500 })
  }
}
