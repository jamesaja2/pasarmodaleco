import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })

    return NextResponse.json({
      currentDay: dayControl?.currentDay ?? 0,
      totalDays: dayControl?.totalDays ?? 15,
      isSimulationActive: dayControl?.isSimulationActive ?? false,
      simulationStartDate: dayControl?.simulationStartDate,
      lastDayChange: dayControl?.lastDayChange,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch day status', error)
    return NextResponse.json({ error: 'Failed to fetch day status' }, { status: 500 })
  }
}
