'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

interface TickerEntry {
  stockCode: string
  companyName: string
  latestPrice: number
  previousPrice: number | null
  change: number
  changePercent: number
  dayNumber: number | null
}

interface LiveTickerProps {
  stockCodes?: string[]
  refreshInterval?: number
}

export function LiveTicker({ stockCodes, refreshInterval = 5000 }: LiveTickerProps) {
  const [entries, setEntries] = useState<TickerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDay, setCurrentDay] = useState(0)
  const { subscribe } = useWebSocket()

  const fetchPrices = useCallback(async () => {
    try {
      const response = await fetch('/api/obs/prices')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      
      let filteredEntries = data.entries ?? []
      if (stockCodes && stockCodes.length > 0) {
        filteredEntries = filteredEntries.filter((e: TickerEntry) => 
          stockCodes.includes(e.stockCode)
        )
      }
      
      setEntries(filteredEntries)
      setCurrentDay(data.currentDay ?? 0)
    } catch (error) {
      console.error('Failed to fetch ticker prices', error)
    } finally {
      setLoading(false)
    }
  }, [stockCodes])

  useEffect(() => {
    fetchPrices()
    
    // Polling untuk update berkala
    const interval = setInterval(fetchPrices, refreshInterval)
    
    return () => clearInterval(interval)
  }, [fetchPrices, refreshInterval])

  // Subscribe to day change events untuk refresh otomatis
  useEffect(() => {
    const unsubscribe = subscribe('day_changed', (data: { currentDay: number }) => {
      setCurrentDay(data.currentDay)
      // Fetch ulang harga saat hari berubah
      fetchPrices()
    })

    return unsubscribe
  }, [subscribe, fetchPrices])

  // Subscribe to price updates
  useEffect(() => {
    const unsubscribe = subscribe('price_update', (data: { stockCode: string; price: number }) => {
      setEntries((prev) => 
        prev.map((entry) => {
          if (entry.stockCode === data.stockCode) {
            const change = data.price - (entry.previousPrice ?? entry.latestPrice)
            const changePercent = entry.previousPrice && entry.previousPrice !== 0
              ? (change / entry.previousPrice) * 100
              : 0
            return {
              ...entry,
              latestPrice: data.price,
              change,
              changePercent,
            }
          }
          return entry
        })
      )
    })

    return unsubscribe
  }, [subscribe])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-4 text-center">
        Belum ada data harga saham
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 px-1">Hari {currentDay}</div>
      {entries.map((entry) => {
        const isPositive = entry.change > 0
        const isNegative = entry.change < 0
        const isNeutral = entry.change === 0

        return (
          <div
            key={entry.stockCode}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div>
              <p className="font-semibold text-sm text-emerald-600">{entry.stockCode}</p>
              <p className="text-xs text-gray-600">Rp {entry.latestPrice.toLocaleString('id-ID')}</p>
            </div>
            <div className={`flex items-center gap-1 ${
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
            }`}>
              {isPositive && <TrendingUp className="w-4 h-4" />}
              {isNegative && <TrendingDown className="w-4 h-4" />}
              {isNeutral && <Minus className="w-4 h-4" />}
              <span className="text-sm font-semibold">
                {isPositive ? '+' : ''}{entry.changePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
