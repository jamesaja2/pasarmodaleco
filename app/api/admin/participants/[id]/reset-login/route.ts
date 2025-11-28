import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { UserRole } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin(request)
    const { id } = await context.params

    const participant = await prisma.user.findUnique({
      where: { id },
    })

    if (!participant) {
      return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
    }

    if (participant.role !== UserRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Hanya peserta yang bisa direset login' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id },
      data: { hasLoggedIn: false },
    })

    return NextResponse.json({ 
      success: true,
      message: 'Login berhasil direset. Peserta dapat login kembali.'
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    console.error('Reset login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
