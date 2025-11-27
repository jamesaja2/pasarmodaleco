import { NextResponse } from 'next/server'
import '@/lib/realtime-server'

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Jakarta',
    unix: Math.floor(Date.now() / 1000),
  })
}
