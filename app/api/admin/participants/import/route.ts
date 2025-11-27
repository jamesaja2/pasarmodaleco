import { NextRequest, NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { parse } from 'csv-parse/sync'
import { Prisma, UserRole } from '@prisma/client'
import { requireAdmin, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REQUIRED_COLUMNS = ['username', 'password', 'team_name', 'school_origin', 'starting_balance'] as const

type CsvRecord = Record<string, string>

type ImportSummary = {
  processed: number
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

function getString(record: CsvRecord, key: string) {
  const raw = record[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseNumber(value: string) {
  if (!value) return NaN
  const normalized = value.replace(/[^0-9,.-]/g, '').replace(',', '.')
  return Number(normalized)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File CSV tidak ditemukan' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = buffer.toString('utf-8')

    const records = parse(text, {
      columns: (header: string[]) => header.map(normalizeHeader),
      skip_empty_lines: true,
      bom: true,
      trim: true,
    }) as CsvRecord[]

    if (!records.length) {
      return NextResponse.json({
        success: true,
        summary: { processed: 0, created: 0, skipped: 0, errors: [{ row: 0, message: 'File CSV kosong' }] },
      })
    }

    const availableColumns = Object.keys(records[0])
    const missing = REQUIRED_COLUMNS.filter((column) => !availableColumns.includes(column))
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Kolom wajib hilang: ${missing.join(', ')}`,
      }, { status: 400 })
    }

    const summary: ImportSummary = {
      processed: records.length,
      created: 0,
      skipped: 0,
      errors: [],
    }

    const brokerCodes = new Set<string>()
    const usernames = new Set<string>()
    for (const record of records) {
      const brokerCode = getString(record, 'broker_code')
      if (brokerCode) {
        brokerCodes.add(brokerCode.toUpperCase())
      }
      const username = getString(record, 'username')
      if (username) {
        usernames.add(username)
      }
    }

    const brokers = brokerCodes.size
      ? await prisma.broker.findMany({
          where: { brokerCode: { in: Array.from(brokerCodes) } },
          select: { id: true, brokerCode: true },
        })
      : []

    const brokerMap = new Map<string, string>()
    for (const broker of brokers) {
      brokerMap.set(broker.brokerCode.toUpperCase(), broker.id)
    }

    const existingUsers = usernames.size
      ? await prisma.user.findMany({
          where: { username: { in: Array.from(usernames) } },
          select: { username: true },
        })
      : []

    const existingUsernameSet = new Set(existingUsers.map((user) => user.username))

    for (let index = 0; index < records.length; index += 1) {
      const row = records[index]
      const rowNumber = index + 2 // account for header line

      try {
        const username = getString(row, 'username')
        const password = getString(row, 'password')
        const teamName = getString(row, 'team_name') || username
        const schoolOrigin = getString(row, 'school_origin')
        const startingBalanceValue = parseNumber(getString(row, 'starting_balance'))
        const brokerCode = getString(row, 'broker_code')

        if (!username) {
          throw new Error('Kolom username wajib diisi')
        }
        if (!password) {
          throw new Error('Kolom password wajib diisi')
        }
        if (!teamName) {
          throw new Error('Kolom team_name wajib diisi')
        }
        if (!schoolOrigin) {
          throw new Error('Kolom school_origin wajib diisi')
        }
        if (!Number.isFinite(startingBalanceValue) || startingBalanceValue < 0) {
          throw new Error('Kolom starting_balance harus berupa angka positif')
        }

        if (existingUsernameSet.has(username)) {
          summary.skipped += 1
          summary.errors.push({ row: rowNumber, message: `Username ${username} sudah terdaftar` })
          continue
        }

        let brokerConnect: { connect: { id: string } } | undefined
        if (brokerCode) {
          const brokerId = brokerMap.get(brokerCode.toUpperCase())
          if (!brokerId) {
            summary.skipped += 1
            summary.errors.push({ row: rowNumber, message: `Broker dengan kode ${brokerCode} tidak ditemukan` })
            continue
          }
          brokerConnect = { connect: { id: brokerId } }
        }

        const passwordHash = await hashPassword(password)
        const startingDecimal = new Prisma.Decimal(startingBalanceValue)

        await prisma.user.create({
          data: {
            username,
            passwordHash,
            role: UserRole.PARTICIPANT,
            teamName,
            schoolOrigin,
            broker: brokerConnect,
            startingBalance: startingDecimal,
            currentBalance: startingDecimal,
            isActive: true,
            credential: {
              create: {
                displayPassword: password,
              },
            },
          },
        })

        summary.created += 1
        existingUsernameSet.add(username)
      } catch (error) {
        summary.skipped += 1
        summary.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Baris tidak valid',
        })
      }
    }

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to import participants CSV', error)
    return NextResponse.json({ error: 'Gagal mengimpor peserta dari CSV' }, { status: 500 })
  }
}
