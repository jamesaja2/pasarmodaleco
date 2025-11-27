import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { broadcastNotification } from '@/lib/realtime-server'
import { getCache, CACHE_KEYS } from '@/lib/cache'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    if (!dayControl?.isSimulationActive) {
      return NextResponse.json({ error: 'Simulation already stopped' }, { status: 400 })
    }

    await prisma.dayControl.update({
      where: { id: dayControl.id },
      data: { isSimulationActive: false },
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.CURRENT_DAY)

    broadcastNotification({
      type: 'warning',
      title: 'Simulasi Berakhir',
      message: 'Simulasi telah diakhiri oleh admin.',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to end simulation', error)
    return NextResponse.json({ error: 'Failed to end simulation' }, { status: 500 })
  }
}
