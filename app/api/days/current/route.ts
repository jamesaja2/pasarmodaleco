import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CACHE_KEYS, getCache } from '@/lib/cache'

type DayControlResponse = {
  currentDay: number
  totalDays: number
  isSimulationActive: boolean
  lastChanged: Date | null | undefined
  timestamp: string
}

export async function GET() {
  const cache = await getCache()
  const cached = await cache.get<DayControlResponse>(CACHE_KEYS.CURRENT_DAY)
  if (cached) {
    return NextResponse.json({ ...cached, timestamp: new Date().toISOString() })
  }

  const dayControl = await prisma.dayControl.findUnique({
    where: { id: 'day-control-singleton' },
  })

  const payload: DayControlResponse = {
    currentDay: dayControl?.currentDay ?? 0,
    totalDays: dayControl?.totalDays ?? 15,
    isSimulationActive: dayControl?.isSimulationActive ?? false,
    lastChanged: dayControl?.lastDayChange,
    timestamp: new Date().toISOString(),
  }

  await cache.set(CACHE_KEYS.CURRENT_DAY, payload, 60)

  return NextResponse.json(payload)
}
