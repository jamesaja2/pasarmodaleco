import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  const stringValue = String(value)
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const participants = (await prisma.user.findMany({
      where: { role: UserRole.PARTICIPANT },
      orderBy: { username: 'asc' },
      include: {
        broker: true,
        credential: true,
      },
    } as any)) as any[]

    const headers = ['Username', 'Password', 'Nama Tim', 'Asal Sekolah', 'Broker', 'Terakhir Reset Password']
    const rows = participants.map((participant) => {
      const brokerLabel = participant.broker
        ? `${participant.broker.brokerCode} - ${participant.broker.brokerName}`
        : 'Belum dipilih'

      return [
        participant.username,
        participant.credential?.displayPassword ?? 'Perlu reset',
        participant.teamName ?? participant.username,
        participant.schoolOrigin ?? '-',
        brokerLabel,
        participant.credential?.lastResetAt ? participant.credential.lastResetAt.toISOString() : '-',
      ]
    })

    const csvLines = [headers, ...rows].map((line) => line.map(toCsvValue).join(',')).join('\r\n')
    const csvContent = `\ufeff${csvLines}`
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kartu-simulasi-${timestamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHENTICATED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    console.error('Failed to export participant cards', error)
    return NextResponse.json({ error: 'Gagal mengekspor kartu peserta' }, { status: 500 })
  }
}
