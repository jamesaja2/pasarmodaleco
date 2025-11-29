import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { z } from 'zod'

function parseAllowedIps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number((value as { toString: () => string }).toString())
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

async function loadSettings() {
  const [sebSetting, ipSetting, startingSetting, dayControl, sebEnabled, ipEnabled, maxPaidNews, paidNewsPrice] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'seb_user_agent' } }),
    prisma.setting.findUnique({ where: { key: 'allowed_ips' } }),
    prisma.setting.findUnique({ where: { key: 'starting_balance' } }),
    prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } }),
    prisma.setting.findUnique({ where: { key: 'seb_enabled' } }),
    prisma.setting.findUnique({ where: { key: 'ip_restriction_enabled' } }),
    prisma.setting.findUnique({ where: { key: 'max_paid_news_per_day' } }),
    prisma.setting.findUnique({ where: { key: 'paid_news_price' } }),
  ])

  return {
    sebUserAgent: typeof sebSetting?.value === 'string' ? sebSetting.value : '',
    sebEnabled: sebEnabled?.value === true || sebEnabled?.value === 'true',
    allowedIps: parseAllowedIps(ipSetting?.value ?? []),
    ipRestrictionEnabled: ipEnabled?.value === true || ipEnabled?.value === 'true',
    startingBalance: toNumber(startingSetting?.value ?? 10000000),
    totalDays: dayControl?.totalDays ?? 15,
    maxPaidNewsPerDay: toNumber(maxPaidNews?.value ?? 5),
    paidNewsPrice: toNumber(paidNewsPrice?.value ?? 500000),
  }
}

const updateSchema = z.object({
  sebUserAgent: z.string().trim().max(255).optional(),
  sebEnabled: z.boolean().optional(),
  allowedIps: z.array(z.string().trim().min(1)).optional(),
  ipRestrictionEnabled: z.boolean().optional(),
  startingBalance: z.number().nonnegative().optional(),
  totalDays: z.number().int().positive().optional(),
  maxPaidNewsPerDay: z.number().int().nonnegative().optional(),
  paidNewsPrice: z.number().nonnegative().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request)
    const settings = await loadSettings()
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to fetch settings', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request)
    const json = await request.json()
    const payload = updateSchema.parse(json)

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (payload.sebUserAgent !== undefined) {
        await tx.setting.upsert({
          where: { key: 'seb_user_agent' },
          update: { value: payload.sebUserAgent },
          create: {
            key: 'seb_user_agent',
            value: payload.sebUserAgent,
            description: 'User agent Safe Exam Browser yang diizinkan',
          },
        })
      }

      if (payload.sebEnabled !== undefined) {
        await tx.setting.upsert({
          where: { key: 'seb_enabled' },
          update: { value: payload.sebEnabled },
          create: {
            key: 'seb_enabled',
            value: payload.sebEnabled,
            description: 'Aktifkan validasi Safe Exam Browser',
          },
        })
      }

      if (payload.allowedIps !== undefined) {
        const normalized = payload.allowedIps.map((ip) => ip.trim()).filter(Boolean)
        await tx.setting.upsert({
          where: { key: 'allowed_ips' },
          update: { value: normalized },
          create: {
            key: 'allowed_ips',
            value: normalized,
            description: 'Daftar IP yang diizinkan mengakses sistem',
          },
        })
      }

      if (payload.ipRestrictionEnabled !== undefined) {
        await tx.setting.upsert({
          where: { key: 'ip_restriction_enabled' },
          update: { value: payload.ipRestrictionEnabled },
          create: {
            key: 'ip_restriction_enabled',
            value: payload.ipRestrictionEnabled,
            description: 'Aktifkan pembatasan IP',
          },
        })
      }

      if (payload.startingBalance !== undefined) {
        await tx.setting.upsert({
          where: { key: 'starting_balance' },
          update: { value: payload.startingBalance },
          create: {
            key: 'starting_balance',
            value: payload.startingBalance,
            description: 'Saldo awal peserta saat registrasi',
          },
        })
      }

      if (payload.totalDays !== undefined) {
        const dayControl = await tx.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
        if (dayControl) {
          await tx.dayControl.update({
            where: { id: dayControl.id },
            data: { totalDays: payload.totalDays },
          })
        } else {
          await tx.dayControl.create({
            data: {
              id: 'day-control-singleton',
              totalDays: payload.totalDays,
              currentDay: 0,
              isSimulationActive: false,
            },
          })
        }
      }

      if (payload.maxPaidNewsPerDay !== undefined) {
        await tx.setting.upsert({
          where: { key: 'max_paid_news_per_day' },
          update: { value: payload.maxPaidNewsPerDay },
          create: {
            key: 'max_paid_news_per_day',
            value: payload.maxPaidNewsPerDay,
            description: 'Maksimal berita berbayar yang bisa dibeli per hari per peserta',
          },
        })
      }

      if (payload.paidNewsPrice !== undefined) {
        await tx.setting.upsert({
          where: { key: 'paid_news_price' },
          update: { value: payload.paidNewsPrice },
          create: {
            key: 'paid_news_price',
            value: payload.paidNewsPrice,
            description: 'Harga per berita berbayar',
          },
        })
      }
    })

    const settings = await loadSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 })
    }
    console.error('Failed to update settings', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
