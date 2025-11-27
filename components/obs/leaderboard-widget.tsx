'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trophy, TrendingUp } from 'lucide-react'
import { useWebSocket } from '@/hooks/use-websocket'

interface LeaderboardEntry {
  rank: number
  teamName: string
  school: string
  portfolioValue: number
  returnPercentage: number
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  total: number
  timestamp: string
}

const REFRESH_INTERVAL_MS = 60_000

export function LeaderboardWidget() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/obs/leaderboard?limit=10', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal memuat leaderboard')
      }
      const payload: LeaderboardResponse = await response.json()
      if (mountedRef.current) {
        setData(payload)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Gagal memuat leaderboard')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard().catch(() => null)
    const interval = setInterval(() => {
      fetchLeaderboard().catch(() => null)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  useEffect(() => {
    const unsubscribe = subscribe('day_changed', () => {
      fetchLeaderboard().catch(() => null)
    })
    return unsubscribe
  }, [fetchLeaderboard, subscribe])

  const topThree = useMemo(() => {
    return data?.leaderboard.slice(0, 3) ?? []
  }, [data?.leaderboard])

  const remaining = useMemo(() => {
    if (!data?.leaderboard) return []
    return data.leaderboard.slice(3)
  }, [data?.leaderboard])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-6xl flex-col gap-10">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Papan Klasemen</p>
          <h1 className="mt-4 text-4xl font-semibold text-white md:text-6xl">Top 10 Peserta</h1>
          <p className="mt-2 text-base text-slate-300">
            Urutan berdasarkan nilai portofolio terkini. Pembaruan otomatis saat hari simulasi berubah.
          </p>
          {error && !loading ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/20 to-amber-500/10 p-6 text-white shadow-[0_0_50px_rgba(234,179,8,0.35)]">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-300" />
              <h2 className="text-2xl font-bold">Podium Tertinggi</h2>
            </div>
            <div className="mt-6 space-y-4">
              {topThree.length === 0 && !loading ? (
                <p className="text-sm text-yellow-100/80">Data belum tersedia.</p>
              ) : null}
              {topThree.map((entry) => (
                <article
                  key={entry.rank}
                  className="flex items-center justify-between rounded-2xl bg-black/20 px-5 py-4"
                >
                  <div>
                    <div className="text-sm uppercase tracking-wide text-yellow-200/90">
                      #{entry.rank}
                    </div>
                    <p className="text-xl font-semibold">{entry.teamName}</p>
                    <p className="text-xs text-yellow-100/80">{entry.school}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-yellow-200/90">Nilai Portofolio</p>
                    <p className="text-2xl font-bold">Rp {entry.portfolioValue.toLocaleString('id-ID')}</p>
                    <p className={`text-sm ${entry.returnPercentage >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                      {entry.returnPercentage >= 0 ? '+' : ''}
                      {entry.returnPercentage.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 text-white">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-emerald-300" />
              <h2 className="text-2xl font-semibold">Posisi Selanjutnya</h2>
            </div>
            <div className="mt-5 divide-y divide-white/5 border-t border-white/10">
              {remaining.length === 0 && !loading ? (
                <p className="py-6 text-sm text-slate-300">Menunggu data tambahan.</p>
              ) : null}
              {remaining.map((entry) => (
                <article key={entry.rank} className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm text-slate-300">#{entry.rank}</p>
                    <p className="text-lg font-semibold text-white">{entry.teamName}</p>
                    <p className="text-xs text-slate-400">{entry.school}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Rp {entry.portfolioValue.toLocaleString('id-ID')}</p>
                    <p className={`text-sm ${entry.returnPercentage >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {entry.returnPercentage >= 0 ? '+' : ''}
                      {entry.returnPercentage.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {data?.timestamp ? (
          <footer className="text-center text-sm text-slate-400">
            Pembaruan terakhir: {formatTimestamp(data.timestamp)}
          </footer>
        ) : null}
      </div>
    </main>
  )
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return 'baru saja'
  }
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date)
}
