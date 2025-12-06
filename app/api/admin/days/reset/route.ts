import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { broadcastNotification } from '@/lib/realtime-server'
import { getCache, CACHE_KEYS } from '@/lib/cache'
import { configureAutoDay } from '@/lib/day-scheduler'
import { Prisma } from '@prisma/client'

const bodySchema = z.object({
  confirmation: z.literal('RESET'),
})

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const json = await request.json()
    const { confirmation } = bodySchema.parse(json)

    if (confirmation !== 'RESET') {
      return NextResponse.json({ error: 'Invalid confirmation value' }, { status: 400 })
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.transaction.deleteMany()
      await tx.portfolioHolding.deleteMany()
      await tx.userNewsPurchase.deleteMany()

      const participants = await tx.user.findMany({
        where: { role: 'PARTICIPANT' },
        select: { id: true, startingBalance: true },
      })

      for (const participant of participants) {
        await tx.user.update({
          where: { id: participant.id },
          data: {
            currentBalance: participant.startingBalance,
            brokerId: null,
          } as any,
        })
      }

      await tx.dayControl.upsert({
        where: { id: 'day-control-singleton' },
        update: {
          isSimulationActive: false,
          currentDay: 0,
          lastDayChange: new Date(),
          remainingMs: null,
          isPaused: false,
          pausedAt: null,
        },
        create: {
          id: 'day-control-singleton',
          isSimulationActive: false,
          currentDay: 0,
          totalDays: 15,
          lastDayChange: new Date(),
          remainingMs: null,
          isPaused: false,
        },
      })

      await tx.stockPrice.updateMany({
        data: { isActive: false },
      })

      await tx.financialReport.updateMany({
        data: { isAvailable: false },
      })
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.CURRENT_DAY)
    await cache.del(CACHE_KEYS.LEADERBOARD)

    // Pastikan scheduler otomatis dimatikan saat reset supaya countdown OBS tidak lanjut dari jadwal lama
    await configureAutoDay({ enabled: false })

    broadcastNotification({
      type: 'warning',
      title: 'Simulasi Direset',
      message: 'Seluruh data simulasi telah direset oleh admin.',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to reset simulation', error)
    return NextResponse.json({ error: 'Failed to reset simulation' }, { status: 500 })
  }
}
