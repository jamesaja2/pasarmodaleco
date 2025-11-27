'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from './use-websocket'

interface DayNotification {
  currentDay: number
  message: string
  timestamp: string
}

export function useDayNotifications() {
  const [notification, setNotification] = useState<DayNotification | null>(null)
  const { subscribe } = useWebSocket()

  useEffect(() => {
    const unsubscribe = subscribe('day_changed', (data: any) => {
      const notif: DayNotification = {
        currentDay: data.currentDay,
        message: `Hari ${data.currentDay} dimulai!`,
        timestamp: new Date().toISOString(),
      }
      setNotification(notif)

      // Auto-dismiss after 5 seconds
      setTimeout(() => setNotification(null), 5000)

      // Play notification sound if available
      playNotificationSound()
    })

    return unsubscribe
  }, [subscribe])

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/sounds/bell.mp3')
      audio.play().catch(() => console.log('Could not play notification sound'))
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  return { notification, hasNotification: notification !== null }
}
