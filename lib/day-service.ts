import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { broadcastDayChanged, broadcastNotification } from './realtime-server'
import { getCache, CACHE_KEYS } from './cache'

export type DaySimulationErrorCode =
  | 'ALREADY_STARTED'
  | 'NOT_CONFIGURED'
  | 'NOT_ACTIVE'
  | 'LIMIT_REACHED'

export class DaySimulationError extends Error {
  code: DaySimulationErrorCode

  constructor(code: DaySimulationErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'DaySimulationError'
    this.code = code
  }
}

async function activatePricesForDay(tx: Prisma.TransactionClient, dayNumber: number) {
  await tx.stockPrice.updateMany({
    where: { dayNumber },
    data: { isActive: true },
  })
  await tx.financialReport.updateMany({
    where: { dayNumber },
    data: { isAvailable: true },
  })
}

/**
 * Calculate compound interest for all participants based on their broker's interest rate
 * Interest is calculated on total stock holdings value (NOT including cash) and added to cash balance
 */
async function applyCompoundInterest(tx: Prisma.TransactionClient, dayNumber: number) {
  // Get all active participants with their broker and portfolio
  const participants = await tx.user.findMany({
    where: {
      role: 'PARTICIPANT',
      isActive: true,
      broker: { isNot: null },
    },
    include: {
      broker: true,
      portfolio: {
        include: {
          company: {
            include: {
              prices: {
                where: { isActive: true },
                orderBy: { dayNumber: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  const interestPayments: {
    userId: string
    brokerId: string
    dayNumber: number
    portfolioValue: Prisma.Decimal
    interestRate: Prisma.Decimal
    interestAmount: Prisma.Decimal
    balanceBefore: Prisma.Decimal
    balanceAfter: Prisma.Decimal
  }[] = []

  for (const participant of participants) {
    // Type assertion for broker with interestRate (Prisma TS cache issue workaround)
    const broker = participant.broker as (typeof participant.broker & { interestRate: Prisma.Decimal }) | null
    if (!broker || Number(broker.interestRate) <= 0) {
      continue
    }

    // Calculate total investment value from holdings (stocks only, NOT cash)
    let investmentValue = new Prisma.Decimal(0)
    for (const holding of participant.portfolio) {
      const currentPrice = holding.company.prices[0]?.price ?? new Prisma.Decimal(0)
      const holdingValue = currentPrice.mul(holding.quantity)
      investmentValue = investmentValue.add(holdingValue)
    }

    // Skip if no stock holdings
    if (investmentValue.lessThanOrEqualTo(0)) {
      continue
    }

    // Calculate interest based on STOCK VALUE ONLY: investmentValue * (interestRate / 100)
    const interestRate = broker.interestRate
    const interestAmount = investmentValue.mul(interestRate).div(100)

    if (interestAmount.lessThanOrEqualTo(0)) {
      continue
    }

    const balanceBefore = participant.currentBalance
    const balanceAfter = balanceBefore.add(interestAmount)

    // Update user balance (add interest to cash)
    await tx.user.update({
      where: { id: participant.id },
      data: { currentBalance: balanceAfter },
    })

    // Record interest payment (portfolioValue here means stock value for clarity)
    interestPayments.push({
      userId: participant.id,
      brokerId: broker.id,
      dayNumber,
      portfolioValue: investmentValue, // This is stock value, not total portfolio
      interestRate,
      interestAmount,
      balanceBefore,
      balanceAfter,
    })
  }

  // Bulk insert interest payments (type assertion for Prisma TS cache issue)
  if (interestPayments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (tx as any).interestPayment.createMany({
      data: interestPayments,
    })
  }

  return interestPayments.length
}

export async function startSimulation(): Promise<number> {
  const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })

  if (dayControl?.isSimulationActive && (dayControl.currentDay ?? 0) > 0) {
    throw new DaySimulationError('ALREADY_STARTED', 'Simulation already started')
  }

  const newDay = 1
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.dayControl.upsert({
      where: { id: 'day-control-singleton' },
      update: {
        isSimulationActive: true,
        currentDay: newDay,
        simulationStartDate: new Date(),
        lastDayChange: new Date(),
      },
      create: {
        id: 'day-control-singleton',
        isSimulationActive: true,
        currentDay: newDay,
        totalDays: 15,
        simulationStartDate: new Date(),
        lastDayChange: new Date(),
      },
    })

    await activatePricesForDay(tx, newDay)
  })

  const cache = await getCache()
  await cache.del(CACHE_KEYS.CURRENT_DAY)

  broadcastDayChanged(newDay)
  broadcastNotification({
    type: 'info',
    title: 'Simulasi Dimulai',
    message: `Simulasi dimulai pada hari ${newDay}`,
  })

  return newDay
}

export async function advanceToNextDay(): Promise<number> {
  const dayControl = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })

  if (!dayControl) {
    throw new DaySimulationError('NOT_CONFIGURED', 'Simulation not configured yet')
  }

  if (!dayControl.isSimulationActive) {
    throw new DaySimulationError('NOT_ACTIVE', 'Simulation is not active')
  }

  if (dayControl.currentDay >= dayControl.totalDays) {
    throw new DaySimulationError('LIMIT_REACHED', 'Total days limit reached')
  }

  const newDay = dayControl.currentDay + 1
  let interestCount = 0

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.dayControl.update({
      where: { id: dayControl.id },
      data: {
        currentDay: newDay,
        lastDayChange: new Date(),
      },
    })

    await activatePricesForDay(tx, newDay)

    // Apply compound interest to all participants
    interestCount = await applyCompoundInterest(tx, newDay)
  })

  const cache = await getCache()
  await cache.del(CACHE_KEYS.CURRENT_DAY)
  await cache.del(CACHE_KEYS.STOCK_PRICES(newDay))

  broadcastDayChanged(newDay)
  
  let message = `Hari ${newDay} telah dimulai. Silakan cek harga saham terbaru.`
  if (interestCount > 0) {
    message += ` Bunga harian telah dikreditkan ke ${interestCount} peserta.`
  }
  
  broadcastNotification({
    type: 'info',
    title: 'Hari Baru Dimulai',
    message,
  })

  return newDay
}
