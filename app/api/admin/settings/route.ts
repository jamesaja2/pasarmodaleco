import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
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
  const [sebSetting, ipSetting, startingSetting, dayControl] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'seb_user_agent' } }),
    prisma.setting.findUnique({ where: { key: 'allowed_ips' } }),
    prisma.setting.findUnique({ where: { key: 'starting_balance' } }),
    prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } }),
  ])

  return {
    sebUserAgent: typeof sebSetting?.value === 'string' ? sebSetting.value : '',
    allowedIps: parseAllowedIps(ipSetting?.value ?? []),
    startingBalance: toNumber(startingSetting?.value ?? 10000000),
    totalDays: dayControl?.totalDays ?? 15,
  }
}

const updateSchema = z.object({
  sebUserAgent: z.string().trim().max(255).optional(),
  allowedIps: z.array(z.string().trim().min(1)).optional(),
  startingBalance: z.number().nonnegative().optional(),
  totalDays: z.number().int().positive().optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const settings = await loadSettings()
    return NextResponse.json(settings)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to fetch settings', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to update settings', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
