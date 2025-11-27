import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { configureAutoDay, getAutoDayStatus } from '@/lib/day-scheduler'

const configureSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().positive().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const status = await getAutoDayStatus()
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch auto day status', error)
    return NextResponse.json({ error: 'Failed to fetch auto day status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = configureSchema.parse(body)
    const status = await configureAutoDay(data)
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to configure auto day scheduler', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to configure auto day scheduler' }, { status: 500 })
  }
}
