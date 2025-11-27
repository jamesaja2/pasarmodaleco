'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from './use-websocket'

interface TransactionUpdate {
  id: string
  status: 'pending' | 'completed' | 'failed'
  message: string
  type: 'success' | 'error' | 'info'
  timestamp: string
}

export function useTransactionUpdates() {
  const [updates, setUpdates] = useState<TransactionUpdate[]>([])
  const { subscribe } = useWebSocket()

  useEffect(() => {
    const unsubscribe = subscribe('transaction_status', (data: any) => {
      const update: TransactionUpdate = {
        id: data.id,
        status: data.status,
        message: data.message,
        type: data.status === 'completed' ? 'success' : data.status === 'failed' ? 'error' : 'info',
        timestamp: new Date().toISOString(),
      }

      setUpdates((prev) => [update, ...prev].slice(0, 10)) // Keep last 10

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setUpdates((prev) => prev.filter((u) => u.id !== update.id))
      }, 5000)
    })

    return unsubscribe
  }, [subscribe])

  return { updates }
}
