import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin, hashPassword } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const updateAdminSchema = z.object({
  teamName: z.string().optional(),
  schoolOrigin: z.string().optional(),
  password: z.string().min(6).max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request)
    const { id } = await params

    const admin = await prisma.user.findUnique({
      where: { id, role: UserRole.ADMIN },
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
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    return NextResponse.json({ admin })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to fetch admin', error)
    return NextResponse.json({ error: 'Failed to fetch admin' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireSuperAdmin(request)
    const { id } = await params

    const admin = await prisma.user.findUnique({
      where: { id, role: UserRole.ADMIN },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Prevent editing super admin by non-super admin or self-demotion
    if (admin.isSuperAdmin && admin.id !== currentUser.id) {
      return NextResponse.json({ error: 'Cannot edit another Super Admin' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateAdminSchema.parse(body)

    const updateData: any = {}
    if (data.teamName !== undefined) updateData.teamName = data.teamName
    if (data.schoolOrigin !== undefined) updateData.schoolOrigin = data.schoolOrigin
    if (data.isActive !== undefined) {
      // Cannot deactivate super admin
      if (admin.isSuperAdmin && !data.isActive) {
        return NextResponse.json({ error: 'Cannot deactivate Super Admin' }, { status: 400 })
      }
      updateData.isActive = data.isActive
    }
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password)
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ success: true, admin: updated })
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
    console.error('Failed to update admin', error)
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(request)
    const { id } = await params

    const admin = await prisma.user.findUnique({
      where: { id, role: UserRole.ADMIN },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Cannot delete super admin
    if (admin.isSuperAdmin) {
      return NextResponse.json({ error: 'Cannot delete Super Admin' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to delete admin', error)
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
