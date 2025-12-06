import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function POST() {
  try {
    await requireAdmin()

    const result = await prisma.user.updateMany({
      where: { role: UserRole.PARTICIPANT },
      data: { hasLoggedIn: false },
    })

    return NextResponse.json({
      success: true,
      resetCount: result.count,
      message: `${result.count} peserta berhasil direset status loginnya`,
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

    console.error('Failed to reset logins in bulk', error)
    return NextResponse.json({ error: 'Failed to reset login status' }, { status: 500 })
  }
}
