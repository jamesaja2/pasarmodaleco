'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useWebSocket } from '@/hooks/use-websocket'

const REFRESH_INTERVAL_MS = 60_000

interface TickerEntry {
  stockCode: string
  companyName: string
  latestPrice: number
  previousPrice: number | null
  change: number
  changePercent: number
  updatedAt: string | null
}

interface PriceUpdatePayload {
  stockCode: string
  price: number
  timestamp: string
}

export function TickerWidget() {
  const [entries, setEntries] = useState<TickerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscribe, send } = useWebSocket()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/obs/prices', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Gagal memuat data harga')
      }
      const data: { entries: TickerEntry[] } = await response.json()
      if (mountedRef.current) {
        setEntries(data.entries)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data harga')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchData().catch(() => null)
    const interval = setInterval(() => {
      fetchData().catch(() => null)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (!entries.length) return
    send('subscribe_prices', { stockCodes: entries.map((entry) => entry.stockCode) })
  }, [entries, send])

  useEffect(() => {
    const unsubscribe = subscribe('price_update', (payload: PriceUpdatePayload) => {
      const code = payload.stockCode.toUpperCase()
      setEntries((current) => {
        if (!current.length) return current
        let updated = false
        const next = current.map((entry) => {
          if (entry.stockCode !== code) {
            return entry
          }
          updated = true
          const previous = entry.latestPrice
          const latestPrice = payload.price
          const change = latestPrice - previous
          const changePercent = previous !== 0 ? (change / previous) * 100 : 0
          return {
            ...entry,
            previousPrice: previous,
            latestPrice,
            change,
            changePercent,
            updatedAt: payload.timestamp,
          }
        })

        if (!updated) {
          next.push({
            stockCode: code,
            companyName: code,
            latestPrice: payload.price,
            previousPrice: null,
            change: 0,
            changePercent: 0,
            updatedAt: payload.timestamp,
          })
        }

        return next
      })
    })

    return unsubscribe
  }, [subscribe])

  const duplicatedEntries = useMemo(() => {
    const target = entries.length ? entries : placeholderEntries
    return [...target, ...target]
  }, [entries])

  const marqueeDuration = useMemo(() => {
    const count = entries.length || placeholderEntries.length
    return Math.max(20, count * 6)
  }, [entries.length])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-7xl flex-col gap-8">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Pasar Modal Live</p>
          <h1 className="mt-4 text-4xl font-semibold text-white md:text-6xl">Live Stock Ticker</h1>
          <p className="mt-2 text-base text-slate-300">
            Harga saham terkini diperbarui otomatis melalui WebSocket.
          </p>
          {error && !loading ? (
            <p className="mt-3 text-sm text-red-300">{error}</p>
          ) : null}
        </header>

        <section className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 py-6">
          <div
            className="flex min-w-full items-center gap-6"
            style={{
              animation: `ticker-scroll ${marqueeDuration}s linear infinite`,
            }}
          >
            {duplicatedEntries.map((entry, index) => (
              <article
                key={`${entry.stockCode}-${index}`}
                className="flex min-w-[220px] flex-col gap-2 rounded-2xl bg-white/5 px-5 py-4 text-left shadow-[0_0_30px_rgba(15,23,42,0.4)]"
              >
                <div className="flex items-center justify-between text-sm uppercase tracking-wide text-slate-300">
                  <span className="font-semibold text-white">{entry.stockCode}</span>
                  <span className="text-xs text-slate-400">{entry.companyName}</span>
                </div>
                <div className="text-3xl font-extrabold text-white">
                  Rp {entry.latestPrice.toLocaleString('id-ID')}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {entry.change >= 0 ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ArrowUpRight className="h-4 w-4" />
                      +{entry.change.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-400">
                      <ArrowDownRight className="h-4 w-4" />
                      {entry.change.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </span>
                  )}
                  <span className="text-slate-300">
                    ({entry.changePercent >= 0 ? '+' : ''}
                    {entry.changePercent.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%)
                  </span>
                </div>
                {entry.updatedAt ? (
                  <p className="text-xs text-slate-400">
                    diperbarui {formatRelative(entry.updatedAt)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <style jsx>{`
            @keyframes ticker-scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
          `}</style>
        </section>
      </div>
    </main>
  )
}

const placeholderEntries: TickerEntry[] = [
  {
    stockCode: 'AKNA',
    companyName: 'Akuna Energi',
    latestPrice: 5600,
    previousPrice: 5500,
    change: 100,
    changePercent: 1.82,
    updatedAt: null,
  },
  {
    stockCode: 'KJNL',
    companyName: 'Kejora Niaga',
    latestPrice: 4250,
    previousPrice: 4200,
    change: 50,
    changePercent: 1.19,
    updatedAt: null,
  },
  {
    stockCode: 'BBCC',
    companyName: 'Bersama Capital',
    latestPrice: 2650,
    previousPrice: 2600,
    change: 50,
    changePercent: 1.92,
    updatedAt: null,
  },
  {
    stockCode: 'ESDA',
    companyName: 'Esda Mineral',
    latestPrice: 3850,
    previousPrice: 3750,
    change: 100,
    changePercent: 2.67,
    updatedAt: null,
  },
  {
    stockCode: 'TPDU',
    companyName: 'Tapadu Digital',
    latestPrice: 1580,
    previousPrice: 1550,
    change: 30,
    changePercent: 1.94,
    updatedAt: null,
  },
]

function formatRelative(timestamp: string) {
  const target = new Date(timestamp)
  if (Number.isNaN(target.getTime())) {
    return 'baru saja'
  }
  const diff = Date.now() - target.getTime()
  const seconds = Math.max(Math.floor(diff / 1000), 0)
  if (seconds < 60) return `${seconds} detik lalu`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  return `${hours} jam lalu`
}
