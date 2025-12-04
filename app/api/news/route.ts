import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { z } from 'zod'

const querySchema = z.object({
  day: z.coerce.number().min(0).max(365).optional(),
  type: z.enum(['all', 'free', 'paid']).optional(),
  sort: z.enum(['latest', 'oldest']).optional(),
})

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

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

    // Get paid news settings
    const paidNewsPriceSetting = await prisma.setting.findUnique({ 
      where: { key: 'paid_news_price' } 
    })
    const paidNewsPrice = toNumber(paidNewsPriceSetting?.value ?? 500000)

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

    // Filter and map news
    const filteredNews = newsList.filter((item) => {
      // Admin sees everything
      if (user.role === 'ADMIN') return true
      
      // Free news always visible
      if (!item.isPaid) return true
      
      // Purchased paid news always visible (even from previous days)
      const isPurchased = Array.isArray(item.purchases) && item.purchases.length > 0
      if (isPurchased) return true
      
      // Unpurchased paid news only visible for current day
      return item.dayNumber === currentDay
    })

    // Sort: paid news first, then by publishedAt
    const sortedNews = filteredNews.sort((a, b) => {
      // Paid news comes first
      if (a.isPaid && !b.isPaid) return -1
      if (!a.isPaid && b.isPaid) return 1
      // Then sort by publishedAt
      const dateA = new Date(a.publishedAt).getTime()
      const dateB = new Date(b.publishedAt).getTime()
      return sort === 'latest' ? dateB - dateA : dateA - dateB
    })

    const payload = {
      news: sortedNews.map((item) => {
        const isPurchased = user.role === 'ADMIN' ? true : Array.isArray(item.purchases) ? item.purchases.length > 0 : false
        
        // For paid news that hasn't been purchased by participant, hide the title and content
        const hidePaidContent = user.role === 'PARTICIPANT' && item.isPaid && !isPurchased
        
        return {
          id: item.id,
          title: hidePaidContent ? 'Berita Berbayar' : item.title,
          preview: hidePaidContent ? 'Beli berita ini untuk melihat isinya. Anda akan mendapatkan berita acak dari pool berita berbayar hari ini.' : (item.content.slice(0, 160) + (item.content.length > 160 ? '...' : '')),
          dayNumber: item.dayNumber,
          isPaid: item.isPaid,
          price: item.isPaid ? paidNewsPrice : null,
          companyCode: hidePaidContent ? null : (item.company?.stockCode ?? null),
          publishedAt: item.publishedAt,
          isPurchased,
          isHidden: hidePaidContent,
        }
      }),
      total: filteredNews.length,
      paidNewsPrice,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch news', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
