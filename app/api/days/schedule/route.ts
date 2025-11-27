import { NextResponse } from 'next/server'
import { getAutoDayStatus } from '@/lib/day-scheduler'

export async function GET() {
  try {
    const status = await getAutoDayStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to fetch day scheduler status', error)
    return NextResponse.json({ error: 'Failed to fetch scheduler status' }, { status: 500 })
  }
}
