import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSessionToken, verifyPassword } from '@/lib/auth'
import { enforceSecurity } from '@/lib/security'
import { UserRole } from '@prisma/client'

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['admin', 'participant']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const json = await request.json()
    const { username, password, role } = loginSchema.parse(json)

    const effectiveRole = role ?? 'participant'
    if (effectiveRole !== 'admin') {
      const security = await enforceSecurity(request)
      if (!security.allowed) {
        return NextResponse.json({ error: security.error }, { status: 403 })
      }
    }

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: {
        broker: true,
        credential: true,
      },
    } as any)

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const expectedRole = effectiveRole === 'admin' ? UserRole.ADMIN : UserRole.PARTICIPANT
    if (user.role !== expectedRole) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 })
    }

    // Check if participant has already logged in before (one-time login restriction)
    if (user.role === UserRole.PARTICIPANT && user.hasLoggedIn) {
      return NextResponse.json({ 
        error: 'Akun ini sudah pernah login sebelumnya. Hubungi admin untuk reset login.' 
      }, { status: 403 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastLogin: new Date(),
        hasLoggedIn: user.role === UserRole.PARTICIPANT ? true : user.hasLoggedIn,
      },
    })

    const token = await createSessionToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      teamName: user.teamName ?? undefined,
    })

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamName: user.teamName,
        schoolOrigin: user.schoolOrigin,
        broker: user.broker
          ? {
              id: user.broker.id,
              code: user.broker.brokerCode,
              name: user.broker.brokerName,
              feePercentage: user.broker.feePercentage,
            }
          : null,
        currentBalance: user.currentBalance,
        startingBalance: user.startingBalance,
        requiresBrokerSelection: !user.brokerId,
      },
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }

    if (error instanceof Error && (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 })
    }

    console.error('Login error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
