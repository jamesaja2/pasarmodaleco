import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_LIMIT = 20

export async function GET() {
  try {
    // Ambil current day dari database
    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0

    const companies = await prisma.company.findMany({
      orderBy: { stockCode: 'asc' },
      take: DEFAULT_LIMIT,
    })

    if (companies.length === 0) {
      return NextResponse.json({
        entries: [],
        total: 0,
        currentDay,
        timestamp: new Date().toISOString(),
      })
    }

    const companyIds = companies.map((company) => company.id)

    // Ambil harga yang sudah aktif (isActive = true) ATAU harga hari sebelumnya yang <= currentDay
    const priceRecords = await prisma.stockPrice.findMany({
      where: {
        companyId: { in: companyIds },
        OR: [
          { isActive: true },
          { dayNumber: { lte: currentDay } },
        ],
      },
      orderBy: [{ companyId: 'asc' }, { dayNumber: 'desc' }],
    })

    const priceMap = new Map<string, {
      latest: number
      previous: number | null
      dayNumber: number
      capturedAt: Date
    }>()

    for (const record of priceRecords) {
      // Hanya ambil harga yang aktif atau dayNumber <= currentDay
      if (!record.isActive && record.dayNumber > currentDay) {
        continue
      }

      const current = priceMap.get(record.companyId)
      const numericPrice = Number(record.price)

      if (!current) {
        priceMap.set(record.companyId, {
          latest: numericPrice,
          previous: null,
          dayNumber: record.dayNumber,
          capturedAt: record.createdAt,
        })
        continue
      }

      if (current.previous === null && record.dayNumber < current.dayNumber) {
        current.previous = numericPrice
      }
    }

    const entries = companies.map((company) => {
      const info = priceMap.get(company.id)
      const latestPrice = info?.latest ?? 0
      const previousPrice = info?.previous ?? null
      const change = previousPrice != null ? latestPrice - previousPrice : 0
      const changePercent = previousPrice != null && previousPrice !== 0
        ? (change / previousPrice) * 100
        : 0

      return {
        stockCode: company.stockCode,
        companyName: company.companyName,
        latestPrice,
        previousPrice,
        change,
        changePercent,
        dayNumber: info?.dayNumber ?? null,
        updatedAt: info?.capturedAt ? info.capturedAt.toISOString() : null,
      }
    })

    return NextResponse.json({
      entries,
      total: entries.length,
      currentDay,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch obs prices', error)
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 })
  }
}
