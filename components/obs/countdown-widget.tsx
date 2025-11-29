'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'

type DayControl = {
  currentDay: number
  totalDays: number
  isSimulationActive: boolean
  lastChanged: string | null
  timestamp: string
}

type SchedulerStatus = {
  enabled: boolean
  intervalMinutes: number | null
  nextRunAt: string | null
  isPaused?: boolean
  remainingMs?: number | null
}

type CountdownState = {
  hours: string
  minutes: string
  seconds: string
  totalMs: number
}

const SCHEDULE_REFRESH_MS = 30_000

export function CountdownWidget() {
  const [day, setDay] = useState<DayControl | null>(null)
  const [schedule, setSchedule] = useState<SchedulerStatus | null>(null)
  const [dayError, setDayError] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const { subscribe } = useWebSocket()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchDay = useCallback(async () => {
    try {
      const response = await fetch('/api/obs/days/current', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal memuat info hari')
      }
      const data: DayControl = await response.json()
      if (mountedRef.current) {
        setDay(data)
        setDayError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setDayError(err instanceof Error ? err.message : 'Gagal memuat info hari')
      }
    }
  }, [])

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/days/schedule', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal memuat status scheduler')
      }
      const data: SchedulerStatus = await response.json()
      if (mountedRef.current) {
        setSchedule(data)
        setScheduleError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setScheduleError(err instanceof Error ? err.message : 'Gagal memuat status scheduler')
      }
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchDay(), fetchSchedule()])
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    bootstrap().catch(() => {
      if (mountedRef.current) {
        setLoading(false)
      }
    })

    const interval = setInterval(() => {
      fetchSchedule().catch(() => null)
    }, SCHEDULE_REFRESH_MS)

    const dayInterval = setInterval(() => {
      fetchDay().catch(() => null)
    }, 15_000)

    return () => {
      clearInterval(interval)
      clearInterval(dayInterval)
    }
  }, [fetchDay, fetchSchedule])

  useEffect(() => {
    const unsubscribe = subscribe('day_changed', () => {
      fetchDay().catch(() => null)
      fetchSchedule().catch(() => null)
    })

    return unsubscribe
  }, [fetchDay, fetchSchedule, subscribe])

  const countdown: CountdownState | null = useMemo(() => {
    // When paused, show remaining time frozen
    if (schedule?.isPaused && schedule.remainingMs) {
      const clamped = Math.max(schedule.remainingMs, 0)
      const hours = Math.floor(clamped / 3_600_000)
      const minutes = Math.floor((clamped % 3_600_000) / 60_000)
      const seconds = Math.floor((clamped % 60_000) / 1000)

      const pad = (value: number) => value.toString().padStart(2, '0')

      return {
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
        totalMs: clamped,
      }
    }
    
    if (!schedule?.enabled || !schedule.nextRunAt) {
      return null
    }
    const target = new Date(schedule.nextRunAt).getTime()
    if (Number.isNaN(target)) {
      return null
    }
    const diff = target - now
    const totalMs = diff
    const clamped = Math.max(diff, 0)
    const hours = Math.floor(clamped / 3_600_000)
    const minutes = Math.floor((clamped % 3_600_000) / 60_000)
    const seconds = Math.floor((clamped % 60_000) / 1000)

    const pad = (value: number) => value.toString().padStart(2, '0')

    return {
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      totalMs,
    }
  }, [now, schedule?.enabled, schedule?.nextRunAt, schedule?.isPaused, schedule?.remainingMs])

  const currentTimeLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(now)
  }, [now])

  const lastChangeLabel = useMemo(() => {
    if (!day?.lastChanged) {
      return null
    }
    const date = new Date(day.lastChanged)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(date)
  }, [day?.lastChanged])

  const errorMessage = dayError ?? scheduleError

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-6xl flex-col items-center gap-10">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Simulasi Pasar Modal</p>
          <h1 className="mt-4 text-5xl font-bold text-white md:text-7xl">
            {day ? `Hari ${Math.max(day.currentDay, 0)}` : loading ? 'Memuat…' : 'Belum Ada Data'}
          </h1>
          {day && (
            <p className="mt-3 text-lg text-slate-300">
              {day.totalDays > 0 ? `Dari ${day.totalDays} hari simulasi` : 'Total hari belum dikonfigurasi'}
            </p>
          )}
        </header>

        <section className="w-full rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-10 text-center shadow-[0_0_60px_rgba(15,23,42,0.75)]">
          {errorMessage && !loading ? (
            <p className="text-lg text-red-400">{errorMessage}</p>
          ) : countdown ? (
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.5em] text-slate-400">
                {schedule?.isPaused ? '⏸️ COUNTDOWN PAUSED' : 'Menuju Hari Berikutnya'}
              </p>
              <div className={`flex items-center justify-center gap-6 text-[clamp(3rem,12vw,8rem)] font-black ${schedule?.isPaused ? 'text-orange-400 animate-pulse' : ''}`}>
                <span>{countdown.hours}</span>
                <span className={schedule?.isPaused ? 'text-orange-300' : 'text-emerald-400'}>:</span>
                <span>{countdown.minutes}</span>
                <span className={schedule?.isPaused ? 'text-orange-300' : 'text-emerald-400'}>:</span>
                <span>{countdown.seconds}</span>
              </div>
              <p className="text-sm text-slate-300">
                {schedule?.isPaused
                  ? 'Countdown sedang di-pause oleh admin. Waktu akan dilanjutkan saat di-resume.'
                  : countdown.totalMs > 0
                  ? 'Otomatisasi aktif. Bersiaplah untuk pembukaan hari selanjutnya.'
                  : 'Waktu habis. Sistem siap berganti atau menunggu pemicu berikutnya.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.5em] text-slate-400">Tidak Ada Jadwal Otomatis</p>
              <p className="text-lg text-slate-300">
                {schedule?.enabled === false
                  ? 'Pergantian hari otomatis sedang dinonaktifkan. Aktifkan scheduler atau jalankan manual.'
                  : 'Menunggu jadwal berikutnya dari server.'}
              </p>
            </div>
          )}
        </section>

        <footer className="flex w-full flex-col items-center gap-4 text-center text-sm text-slate-400 md:flex-row md:justify-between md:text-left">
          <div>
            <span className="font-semibold text-slate-200">Status:</span>{' '}
            {day ? (
              schedule?.isPaused ? (
                <span className="text-orange-400 font-semibold">⏸️ Paused</span>
              ) : day.isSimulationActive ? (
                'Simulasi aktif'
              ) : (
                'Simulasi nonaktif'
              )
            ) : (
              'Tidak diketahui'
            )}
          </div>
          <div>
            <span className="font-semibold text-slate-200">Terakhir berubah:</span>{' '}
            {lastChangeLabel ?? 'Belum ada perubahan' }
          </div>
          <div>
            <span className="font-semibold text-slate-200">Waktu lokal:</span>{' '}
            {currentTimeLabel}
          </div>
        </footer>
      </div>
    </main>
  )
}
