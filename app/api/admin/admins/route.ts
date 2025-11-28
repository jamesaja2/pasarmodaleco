import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin, hashPassword } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const createAdminSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  teamName: z.string().optional(),
  schoolOrigin: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request)

    const admins = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: {
        id: true,
        username: true,
        teamName: true,
        schoolOrigin: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ admins })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to fetch admins', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request)

    const body = await request.json()
    const data = createAdminSchema.parse(body)

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    })

    if (existing) {
      return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 })
    }

    const passwordHash = await hashPassword(data.password)

    const admin = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        role: UserRole.ADMIN,
        isSuperAdmin: false,
        teamName: data.teamName || null,
        schoolOrigin: data.schoolOrigin || null,
        startingBalance: 0,
        currentBalance: 0,
      },
      select: {
        id: true,
        username: true,
        teamName: true,
        schoolOrigin: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, admin })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to create admin', error)
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}
