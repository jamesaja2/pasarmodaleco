import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCache, CACHE_KEYS } from '@/lib/cache'
import { requireUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireUser(request)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.toLowerCase()
    const sector = searchParams.get('sector')?.toLowerCase()

    const cacheKey = CACHE_KEYS.COMPANIES
    const cache = await getCache()

    if (!search && !sector) {
      const cached = await cache.get<any>(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    const companies = await prisma.company.findMany({
      where: {
        AND: [
          search
            ? {
                OR: [
                  { stockCode: { contains: search, mode: 'insensitive' } },
                  { companyName: { contains: search, mode: 'insensitive' } },
                  { sector: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {},
          sector
            ? {
                sector: {
                  contains: sector,
                  mode: 'insensitive',
                },
              }
            : {},
        ],
      },
      orderBy: { stockCode: 'asc' },
    })

    const payload = {
      companies: companies.map((company) => ({
        id: company.id,
        stockCode: company.stockCode,
        name: company.companyName,
        sector: company.sector,
        description: company.description,
        location: company.location,
        logoUrl: company.logoUrl,
        sellingPrice: company.sellingPrice ? Number(company.sellingPrice) : null,
        sharesOutstanding: company.sharesOutstanding ? Number(company.sharesOutstanding) : null,
      })),
      total: companies.length,
    }

    if (!search && !sector) {
      await cache.set(cacheKey, payload, 3600)
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Failed to fetch companies', error)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}
