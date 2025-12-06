import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { DaySimulationError, startSimulation } from '@/lib/day-service'
import { resetSchedulerTimer } from '@/lib/day-scheduler'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const currentDay = await startSimulation()

    // Clear any remaining pause state and remainingMs
    await prisma.dayControl.update({
      where: { id: 'day-control-singleton' },
      data: {
        remainingMs: null,
        isPaused: false,
        pausedAt: null,
      },
    })
    
    // Reset scheduler timer so countdown starts fresh
    resetSchedulerTimer()
    
    return NextResponse.json({ success: true, currentDay })
  } catch (error) {
    if (error instanceof DaySimulationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to start simulation', error)
    return NextResponse.json({ error: 'Failed to start simulation' }, { status: 500 })
  }
}
