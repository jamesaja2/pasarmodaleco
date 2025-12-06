import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { resumeScheduler } from '@/lib/day-scheduler'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })

    if (!dayControl) {
      return NextResponse.json({ error: 'Simulation not initialized' }, { status: 400 })
    }

    if (!dayControl.isSimulationActive) {
      return NextResponse.json({ error: 'Simulation not active' }, { status: 400 })
    }

    if (!dayControl.isPaused) {
      return NextResponse.json({ error: 'Not paused' }, { status: 400 })
    }

    const remainingMs = dayControl.remainingMs ?? 0

    // Resume the scheduler with remaining time
    if (remainingMs > 0) {
      resumeScheduler(remainingMs)
    }

    // Update database - clear remainingMs after resuming
    await prisma.dayControl.update({
      where: { id: 'day-control-singleton' },
      data: {
        isPaused: false,
        pausedAt: null,
        remainingMs: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Simulation resumed',
      remainingMs,
    })
  } catch (error) {
    console.error('Failed to resume simulation', error)
    return NextResponse.json({ error: 'Failed to resume simulation' }, { status: 500 })
  }
}
