'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from './use-websocket'

interface PriceUpdate {
  stockCode: string
  price: number
  change: number
  changePercent: number
  timestamp: string
}

export function useRealTimePrices(stockCodes?: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({})
  const [connected, setConnected] = useState(false)
  const { subscribe, send, client } = useWebSocket()

  useEffect(() => {
    // Subscribe to price updates
    const unsubscribe = subscribe('price_update', (data: PriceUpdate) => {
      setPrices((prev) => ({
        ...prev,
        [data.stockCode]: data,
      }))
    })

    // Request subscription for specific stocks
    if (stockCodes && stockCodes.length > 0) {
      send('subscribe_prices', { stockCodes })
    }

    setConnected(true)

    return unsubscribe
  }, [subscribe, send, stockCodes])

  const getPrice = useCallback((stockCode: string): PriceUpdate | undefined => {
    return prices[stockCode]
  }, [prices])

  return {
    prices,
    connected,
    getPrice,
  }
}
