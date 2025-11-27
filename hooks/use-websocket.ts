'use client'

import { useEffect, useCallback } from 'react'
import { wsClient } from '@/lib/websocket'

export function useWebSocket() {
  useEffect(() => {
    // Connect on mount
    wsClient.connect().catch((error) => {
      console.error('Failed to connect WebSocket:', error)
    })

    // Cleanup on unmount
    return () => {
      wsClient.close()
    }
  }, [])

  const subscribe = useCallback((eventType: string, callback: Function) => {
    wsClient.on(eventType, callback)

    return () => {
      wsClient.off(eventType, callback)
    }
  }, [])

  const send = useCallback((type: string, payload: any) => {
    wsClient.send(type, payload)
  }, [])

  return {
    subscribe,
    send,
    client: wsClient,
  }
}
