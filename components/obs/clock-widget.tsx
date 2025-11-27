'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'

interface DayControl {
  currentDay: number
  totalDays: number
  isSimulationActive: boolean
  lastChanged: string | null
  timestamp: string
}

interface TimeSyncPayload {
  timestamp: string
}

export function ClockWidget() {
  const [serverTime, setServerTime] = useState<number | null>(null)
  const [day, setDay] = useState<DayControl | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { subscribe } = useWebSocket()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchTime = useCallback(async () => {
    try {
      const response = await fetch('/api/time', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal menyinkronkan waktu server')
      }
      const data: TimeSyncPayload & { unix: number } = await response.json()
      const timestamp = new Date(data.timestamp).getTime()
      if (Number.isNaN(timestamp)) {
        throw new Error('Format waktu tidak valid')
      }
      if (mountedRef.current) {
        setServerTime(timestamp)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Gagal menyinkronkan waktu server')
        setServerTime(Date.now())
      }
    }
  }, [])

  const fetchDay = useCallback(async () => {
    try {
      const response = await fetch('/api/obs/days/current', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal memuat status hari')
      }
      const data: DayControl = await response.json()
      if (mountedRef.current) {
        setDay(data)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Gagal memuat status hari')
      }
    }
  }, [])

  useEffect(() => {
    fetchTime().catch(() => null)
    fetchDay().catch(() => null)
  }, [fetchDay, fetchTime])

  useEffect(() => {
    if (serverTime == null) return
    const interval = setInterval(() => {
      setServerTime((current) => (current != null ? current + 1000 : null))
    }, 1000)
    return () => clearInterval(interval)
  }, [serverTime])

  useEffect(() => {
    const unsubscribeTime = subscribe('time_sync', (payload: TimeSyncPayload) => {
      const timestamp = new Date(payload.timestamp).getTime()
      if (!Number.isNaN(timestamp)) {
        setServerTime(timestamp)
      }
    })

    const unsubscribeDay = subscribe('day_changed', () => {
      fetchDay().catch(() => null)
    })

    return () => {
      unsubscribeTime()
      unsubscribeDay()
    }
  }, [fetchDay, subscribe])

  const formattedTime = useMemo(() => {
    if (serverTime == null) return 'Memuat…'
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(serverTime)
  }, [serverTime])

  const formattedDate = useMemo(() => {
    if (serverTime == null) return '—'
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(serverTime)
  }, [serverTime])

  const daySummary = useMemo(() => {
    if (!day) return 'Status hari tidak tersedia'
    const parts = [] as string[]
    parts.push(`Hari ${Math.max(day.currentDay, 0)} dari ${day.totalDays}`)
    parts.push(day.isSimulationActive ? 'Simulasi aktif' : 'Simulasi nonaktif')
    return parts.join(' • ')
  }, [day])

  const lastChangeLabel = useMemo(() => {
    if (!day?.lastChanged) return null
    const date = new Date(day.lastChanged)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(date)
  }, [day?.lastChanged])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Simulasi Pasar Modal</p>
          <h1 className="text-5xl font-semibold text-white md:text-7xl">Waktu Resmi Kompetisi</h1>
          <p className="text-base text-slate-300">
            Sinkron dengan server untuk memastikan hitungan waktu pertandingan akurat.
          </p>
        </header>

        <section className="flex w-full flex-col items-center gap-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-900/40 px-8 py-12 shadow-[0_0_60px_rgba(15,23,42,0.75)] md:px-12">
          <div className="text-[clamp(3rem,12vw,9rem)] font-black tracking-tight text-white">
            {formattedTime} <span className="text-2xl font-semibold text-emerald-300 align-top">WIB</span>
          </div>
          <div className="text-2xl font-medium text-emerald-100 md:text-3xl">{formattedDate}</div>
          <div className="text-base text-slate-300 md:text-lg">{daySummary}</div>
          {lastChangeLabel ? (
            <div className="text-sm text-slate-400">
              Pergantian terakhir: <span className="text-slate-200">{lastChangeLabel}</span>
            </div>
          ) : null}
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </main>
  )
}
