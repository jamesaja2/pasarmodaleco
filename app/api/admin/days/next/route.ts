import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { DaySimulationError, advanceToNextDay } from '@/lib/day-service'
import { resetSchedulerTimer } from '@/lib/day-scheduler'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const currentDay = await advanceToNextDay()
    
    // Reset scheduler timer so countdown restarts from now
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
    console.error('Failed to increment day', error)
    return NextResponse.json({ error: 'Failed to increment day' }, { status: 500 })
  }
}
