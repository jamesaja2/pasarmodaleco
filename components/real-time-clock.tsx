'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

export function RealTimeClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    // Fetch server time on mount
    const syncTime = async () => {
      try {
        const response = await fetch('/api/time')
        const data = await response.json()
        setTime(new Date(data.timestamp))
      } catch (error) {
        console.error('Failed to sync time:', error)
        setTime(new Date())
      }
    }

    syncTime()

    // Update time every second
    const interval = setInterval(() => {
      setTime((prev) => prev ? new Date(prev.getTime() + 1000) : new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  if (!time) return null

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
      <Clock className="w-4 h-4" />
      {time.toLocaleTimeString('id-ID', { 
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta'
      })} WIB
    </div>
  )
}
