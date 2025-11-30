import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const updateSchema = z.object({
  teamName: z.string().min(1),
  schoolOrigin: z.string().min(1),
  brokerId: z.string().min(1).optional().nullable(),
  startingBalance: z.number().nonnegative(),
  currentBalance: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing || existing.role !== UserRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const updateData: Prisma.UserUpdateInput = {
      teamName: data.teamName,
      schoolOrigin: data.schoolOrigin,
      startingBalance: new Prisma.Decimal(data.startingBalance),
      isActive: data.isActive ?? existing.isActive,
    }

    if (data.brokerId !== undefined) {
      ;(updateData as any).brokerId = data.brokerId || null
    }

    if (data.currentBalance !== undefined) {
      updateData.currentBalance = new Prisma.Decimal(data.currentBalance)
    }

    const participant = await prisma.user.update({
      where: { id },
      data: updateData as any,
      include: { broker: true, credential: true },
    } as any) as any

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        username: participant.username,
        teamName: participant.teamName ?? '',
        schoolOrigin: participant.schoolOrigin ?? '',
        broker: participant.brokerId
          ? {
              id: participant.brokerId,
              code: participant.broker?.brokerCode ?? '',
              name: participant.broker?.brokerName ?? '',
            }
          : null,
        startingBalance: Number(participant.startingBalance),
        currentBalance: Number(participant.currentBalance),
        isActive: participant.isActive,
        createdAt: participant.createdAt,
        requiresBrokerSelection: !participant.brokerId,
      },
    })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to update participant', error)
    return NextResponse.json({ error: 'Failed to update participant' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing || existing.role !== UserRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    // Delete all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete transactions
      await tx.transaction.deleteMany({ where: { userId: id } })
      // Delete portfolio holdings
      await tx.portfolioHolding.deleteMany({ where: { userId: id } })
      // Delete news purchases
      await tx.userNewsPurchase.deleteMany({ where: { userId: id } })
      // Delete participant credential
      await tx.participantCredential.deleteMany({ where: { userId: id } })
      // Finally delete the user
      await tx.user.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to delete participant', error)
    return NextResponse.json({ error: 'Failed to delete participant' }, { status: 500 })
  }
}
