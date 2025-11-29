import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getCache, CACHE_KEYS } from '@/lib/cache'

const companySchema = z.object({
  stockCode: z.string().min(3).max(5),
  companyName: z.string().min(3),
  sector: z.string().min(3),
  description: z.string().optional(),
  location: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  sellingPrice: z.number().positive().optional().nullable(),
  sharesOutstanding: z.number().int().positive().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const companies = await prisma.company.findMany({
      orderBy: { stockCode: 'asc' },
    })

    // Convert BigInt and Decimal to serializable types
    const serializedCompanies = companies.map((company) => ({
      ...company,
      sellingPrice: company.sellingPrice ? Number(company.sellingPrice) : null,
      sharesOutstanding: company.sharesOutstanding ? Number(company.sharesOutstanding) : null,
    }))

    return NextResponse.json({
      companies: serializedCompanies,
      total: companies.length,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch companies (admin)', error)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const data = companySchema.parse(body)

    const company = await prisma.company.create({
      data: {
        stockCode: data.stockCode.toUpperCase(),
        companyName: data.companyName,
        sector: data.sector,
        description: data.description,
        location: data.location,
        logoUrl: data.logoUrl || null,
        sellingPrice: data.sellingPrice ?? null,
        sharesOutstanding: data.sharesOutstanding ?? null,
      },
    })

    const cache = await getCache()
    await cache.del(CACHE_KEYS.COMPANIES)

    return NextResponse.json({ success: true, company })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to create company', error)
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }
}
