import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })

    return NextResponse.json({
      currentDay: dayControl?.currentDay ?? 0,
      totalDays: dayControl?.totalDays ?? 15,
      isSimulationActive: dayControl?.isSimulationActive ?? false,
      lastChanged: dayControl?.lastDayChange ?? null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch day control for OBS', error)
    return NextResponse.json({ error: 'Failed to fetch day status' }, { status: 500 })
  }
}
