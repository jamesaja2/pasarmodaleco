import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, hashPassword } from '@/lib/auth'

const createSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  teamName: z.string().min(1),
  schoolOrigin: z.string().min(1),
  brokerId: z.string().min(1).optional().nullable(),
  startingBalance: z.number().nonnegative(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const participants = (await prisma.user.findMany({
      where: { role: UserRole.PARTICIPANT },
      orderBy: { createdAt: 'desc' },
      include: {
        broker: true,
        credential: true,
      },
    } as any)) as any[]

    const payload = participants.map((participant) => ({
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
    }))

    return NextResponse.json({ participants: payload, total: payload.length })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch participants', error)
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = createSchema.parse(body)

    const existing = await prisma.user.findUnique({ where: { username: data.username } })
    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 409 })
    }

    const passwordHash = await hashPassword(data.password)
    const startingBalanceDecimal = new Prisma.Decimal(data.startingBalance)

    const participant = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        role: UserRole.PARTICIPANT,
        teamName: data.teamName,
        schoolOrigin: data.schoolOrigin,
        broker: data.brokerId ? { connect: { id: data.brokerId } } : undefined,
        startingBalance: startingBalanceDecimal,
        currentBalance: startingBalanceDecimal,
        isActive: data.isActive ?? true,
        credential: {
          create: {
            displayPassword: data.password,
          },
        },
      },
      include: {
        broker: true,
        credential: true,
      },
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
    console.error('Failed to create participant', error)
    return NextResponse.json({ error: 'Failed to create participant' }, { status: 500 })
  }
}
