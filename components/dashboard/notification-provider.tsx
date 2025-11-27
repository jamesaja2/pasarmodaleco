'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import { useToast } from '@/hooks/use-toast'

const MAX_NOTIFICATIONS = 20

export type DashboardNotification = {
  id: string
  title: string
  message: string
  type?: string
  timestamp?: string
  read: boolean
}

type DashboardNotificationContextValue = {
  notifications: DashboardNotification[]
  unreadCount: number
  markAllRead: () => void
  clearAll: () => void
}

const DashboardNotificationContext = createContext<DashboardNotificationContextValue | undefined>(undefined)

export function DashboardNotificationProvider({ children }: { children: ReactNode }) {
  const { subscribe } = useWebSocket()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])

  useEffect(() => {
    const unsubscribe = subscribe('notification', (payload: { title?: string; message?: string; type?: string; timestamp?: string }) => {
      if (!payload?.title || !payload?.message) {
        return
      }

      const timestamp = payload.timestamp ?? new Date().toISOString()
      const id = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
      const notification: DashboardNotification = {
        id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        timestamp,
        read: false,
      }

      setNotifications((prev) => {
        const next = [notification, ...prev]
        return next.slice(0, MAX_NOTIFICATIONS)
      })

      toast({ title: payload.title, description: payload.message })
    })

    return () => {
      unsubscribe()
    }
  }, [subscribe, toast])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications])

  const value = useMemo(
    () => ({ notifications, unreadCount, markAllRead, clearAll }),
    [notifications, unreadCount, markAllRead, clearAll]
  )

  return <DashboardNotificationContext.Provider value={value}>{children}</DashboardNotificationContext.Provider>
}

export function useDashboardNotifications() {
  const context = useContext(DashboardNotificationContext)
  if (!context) {
    throw new Error('useDashboardNotifications must be used within a DashboardNotificationProvider')
  }
  return context
}
