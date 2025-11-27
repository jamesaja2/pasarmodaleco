import { prisma } from './prisma'
import { DaySimulationError, advanceToNextDay, startSimulation } from './day-service'

const SETTING_KEY = 'auto_day_scheduler'
const DEFAULT_INTERVAL_MINUTES = 6
const GLOBAL_STATE_KEY = Symbol.for('auto-day-scheduler-state')
const GLOBAL_INIT_KEY = Symbol.for('auto-day-scheduler-init')

interface SchedulerState {
  enabled: boolean
  intervalMs: number | null
  timer: NodeJS.Timeout | null
  nextRunAt: number | null
  running: boolean
}

type SchedulerSetting = {
  enabled: boolean
  intervalMinutes: number
}

type ConfigureOptions = {
  enabled: boolean
  intervalMinutes?: number
}

function getState(): SchedulerState {
  const globalAny = globalThis as typeof globalThis & {
    [GLOBAL_STATE_KEY]?: SchedulerState
  }
  if (!globalAny[GLOBAL_STATE_KEY]) {
    globalAny[GLOBAL_STATE_KEY] = {
      enabled: false,
      intervalMs: null,
      timer: null,
      nextRunAt: null,
      running: false,
    }
  }
  return globalAny[GLOBAL_STATE_KEY]!
}

function clearTimer(state: SchedulerState) {
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = null
  }
  state.nextRunAt = null
}

function scheduleNextTick(state: SchedulerState) {
  if (!state.enabled || !state.intervalMs) {
    clearTimer(state)
    return
  }

  clearTimer(state)
  state.nextRunAt = Date.now() + state.intervalMs
  state.timer = setTimeout(() => {
    runTick(state).catch((error) => {
      console.error('[auto-day] Tick failed', error)
    })
  }, state.intervalMs)
}

async function ensureSimulationStarted() {
  try {
    const control = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    if (!control || !control.isSimulationActive || control.currentDay === 0) {
      try {
        await startSimulation()
      } catch (error) {
        if (error instanceof DaySimulationError && error.code === 'ALREADY_STARTED') {
          return
        }
        throw error
      }
    }
  } catch (error) {
    console.error('[auto-day] Failed to ensure simulation started', error)
  }
}

async function runTick(state: SchedulerState) {
  state.timer = null
  if (!state.enabled || state.running) {
    return
  }

  state.running = true
  try {
    const control = await prisma.dayControl.findUnique({ where: { id: 'day-control-singleton' } })
    if (!control) {
      await ensureSimulationStarted()
      return
    }

    if (!control.isSimulationActive || control.currentDay === 0) {
      await ensureSimulationStarted()
      return
    }

    if (control.currentDay >= control.totalDays) {
      console.info('[auto-day] Reached final day, disabling scheduler')
      internalDisable(state)
      return
    }

    try {
      await advanceToNextDay()
    } catch (error) {
      if (error instanceof DaySimulationError) {
        if (error.code === 'LIMIT_REACHED') {
          console.info('[auto-day] Limit reached, disabling scheduler')
          internalDisable(state)
          return
        }
        if (error.code === 'NOT_ACTIVE') {
          await ensureSimulationStarted()
          return
        }
      }
      throw error
    }
  } catch (error) {
    console.error('[auto-day] Unexpected error during tick', error)
  } finally {
    state.running = false
    if (state.enabled) {
      scheduleNextTick(state)
    } else {
      clearTimer(state)
    }
  }
}

async function loadSetting(): Promise<void> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } })
    if (!setting) {
      return
    }

    const value = setting.value as SchedulerSetting | null
    if (value?.enabled) {
      await internalEnable(getState(), value.intervalMinutes * 60_000)
    }
  } catch (error) {
    console.error('[auto-day] Failed to load scheduler setting', error)
  }
}

async function internalEnable(state: SchedulerState, intervalMs: number) {
  state.enabled = true
  state.intervalMs = intervalMs
  scheduleNextTick(state)
  await ensureSimulationStarted()
}

function internalDisable(state: SchedulerState) {
  state.enabled = false
  state.intervalMs = null
  clearTimer(state)
}

/**
 * Reset the scheduler timer to start fresh from now.
 * Call this when admin manually advances the day so countdown restarts.
 */
export function resetSchedulerTimer() {
  const state = getState()
  if (state.enabled && state.intervalMs) {
    // Clear existing timer and schedule a new one from now
    scheduleNextTick(state)
  }
}

async function saveSetting(setting: SchedulerSetting) {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: setting },
    create: {
      key: SETTING_KEY,
      value: setting,
      description: 'Konfigurasi scheduler otomatis pergantian hari',
    },
  })
}

async function getInitPromise(): Promise<void> {
  const globalAny = globalThis as typeof globalThis & {
    [GLOBAL_INIT_KEY]?: Promise<void>
  }

  if (!globalAny[GLOBAL_INIT_KEY]) {
    globalAny[GLOBAL_INIT_KEY] = loadSetting()
  }

  return globalAny[GLOBAL_INIT_KEY]!
}

export async function ensureSchedulerInitialized() {
  await getInitPromise()
}

export async function getAutoDayStatus() {
  await ensureSchedulerInitialized()
  const state = getState()
  const intervalMinutes = state.intervalMs ? Math.round(state.intervalMs / 60_000) : null
  return {
    enabled: state.enabled,
    intervalMinutes,
    nextRunAt: state.nextRunAt ? new Date(state.nextRunAt).toISOString() : null,
  }
}

export async function configureAutoDay(options: ConfigureOptions) {
  await ensureSchedulerInitialized()
  const state = getState()

  if (options.enabled) {
    const minutes = options.intervalMinutes ?? (state.intervalMs ? Math.round(state.intervalMs / 60_000) : DEFAULT_INTERVAL_MINUTES)
    if (!minutes || minutes <= 0) {
      throw new Error('Interval harus lebih dari 0 menit')
    }

    await internalEnable(state, minutes * 60_000)
    await saveSetting({ enabled: true, intervalMinutes: minutes })
  } else {
    const currentMinutes = state.intervalMs ? Math.round(state.intervalMs / 60_000) : DEFAULT_INTERVAL_MINUTES
    const minutes = options.intervalMinutes ?? currentMinutes
    internalDisable(state)
    await saveSetting({ enabled: false, intervalMinutes: minutes })
  }

  return getAutoDayStatus()
}
