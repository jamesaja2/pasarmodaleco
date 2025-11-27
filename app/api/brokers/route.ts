import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireUser(request)

    const brokers = await prisma.broker.findMany({
      where: { isActive: true },
      orderBy: { brokerName: 'asc' },
    })

    return NextResponse.json({
      brokers: brokers.map((broker) => ({
        id: broker.id,
        code: broker.brokerCode,
        name: broker.brokerName,
        feePercentage: Number(broker.feePercentage),
        interestRate: Number(broker.interestRate),
        description: broker.description ?? '',
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Failed to fetch brokers', error)
    return NextResponse.json({ error: 'Gagal memuat daftar broker' }, { status: 500 })
  }
}
