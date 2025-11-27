import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  day: z.coerce.number().min(0).max(365).optional(),
  type: z.enum(['all', 'free', 'paid']).optional(),
  sort: z.enum(['latest', 'oldest']).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const { searchParams } = new URL(request.url)

    const queryParams = querySchema.safeParse({
      day: searchParams.get('day') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }

    const { day, type = 'all', sort = 'latest' } = queryParams.data

    // Get current simulation day
    const dayControl = await prisma.dayControl.findUnique({
      where: { id: 'day-control-singleton' },
    })
    const currentDay = dayControl?.currentDay ?? 0
    const isSimulationActive = dayControl?.isSimulationActive ?? false

    // For participants: only show news if simulation is active and dayNumber <= currentDay
    // For admins: show all news
    const dayFilter = user.role === 'ADMIN' 
      ? (day !== undefined ? { dayNumber: day } : {})
      : (isSimulationActive 
          ? { dayNumber: day !== undefined ? { equals: day, lte: currentDay } : { lte: currentDay } }
          : { dayNumber: -1 }) // No news if simulation not active

    const newsList = await prisma.news.findMany({
      where: {
        AND: [
          dayFilter,
          type === 'free' ? { isPaid: false } : {},
          type === 'paid' ? { isPaid: true } : {},
        ],
      },
      include: {
        company: true,
        purchases: user.role === 'PARTICIPANT' ? { where: { userId: user.id } } : false,
      },
      orderBy: {
        publishedAt: sort === 'latest' ? 'desc' : 'asc',
      },
    })

    const payload = {
      news: newsList.map((item) => ({
        id: item.id,
        title: item.title,
        preview: item.content.slice(0, 160) + (item.content.length > 160 ? '...' : ''),
        dayNumber: item.dayNumber,
        isPaid: item.isPaid,
        price: item.price ? Number(item.price) : null,
        companyCode: item.company?.stockCode ?? null,
        publishedAt: item.publishedAt,
        isPurchased:
          user.role === 'ADMIN' ? true : Array.isArray(item.purchases) ? item.purchases.length > 0 : false,
      })),
      total: newsList.length,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch news', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
