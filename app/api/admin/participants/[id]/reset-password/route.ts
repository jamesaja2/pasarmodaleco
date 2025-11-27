import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireAdmin } from '@/lib/auth'

const schema = z.object({
  password: z.string().min(6).optional(),
})

function generateTemporaryPassword() {
  const base = Math.random().toString(36).slice(-6)
  return `Pass${base}!`
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data = schema.parse(body)

    const participant = await prisma.user.findUnique({ where: { id } })
    if (!participant || participant.role !== UserRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const newPassword = data.password ?? generateTemporaryPassword()
    const passwordHash = await hashPassword(newPassword)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      })

      await (tx as any).participantCredential.upsert({
        where: { userId: id },
        update: {
          displayPassword: newPassword,
          lastResetAt: new Date(),
        },
        create: {
          userId: id,
          displayPassword: newPassword,
        },
      })
    })

    return NextResponse.json({ success: true, password: newPassword })
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
    console.error('Failed to reset participant password', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
