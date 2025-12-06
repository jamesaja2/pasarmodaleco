import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { pauseScheduler, getSchedulerStatus } from '@/lib/day-scheduler'

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

    if (dayControl.isPaused) {
      return NextResponse.json({ error: 'Already paused' }, { status: 400 })
    }

    // Get remaining time from scheduler
    const schedulerStatus = getSchedulerStatus()
    const remainingMs = schedulerStatus.nextRunAt 
      ? Math.max(0, schedulerStatus.nextRunAt - Date.now())
      : null

    // Pause the scheduler
    pauseScheduler()

    // Update database
    await prisma.dayControl.update({
      where: { id: 'day-control-singleton' },
      data: {
        isPaused: true,
        pausedAt: new Date(),
        remainingMs: remainingMs || null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Simulation paused',
      remainingMs,
    })
  } catch (error) {
    console.error('Failed to pause simulation', error)
    return NextResponse.json({ error: 'Failed to pause simulation' }, { status: 500 })
  }
}
