'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiClient, ApiError } from '@/lib/api-client'

type UserRole = 'ADMIN' | 'PARTICIPANT'

type SessionBroker = {
  id: string
  code: string
  name: string
  feePercentage: number
}

type SessionUser = {
  id: string
  username: string
  role: UserRole
  teamName?: string | null
  schoolOrigin?: string | null
  currentBalance: number
  startingBalance: number
  broker: SessionBroker | null
  lastLogin?: string | null
  requiresBrokerSelection?: boolean
  isSuperAdmin?: boolean
}

type LoginPayload = {
  username: string
  password: string
  role?: 'admin' | 'participant'
}

type SessionContextValue = {
  user: SessionUser | null
  loading: boolean
  error: string | null
  refreshing: boolean
  login: (payload: LoginPayload) => Promise<SessionUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number((value as { toString: () => string }).toString())
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

function normalizeUser(raw: any): SessionUser {
  return {
    id: String(raw.id),
    username: String(raw.username),
    role: raw.role as UserRole,
    teamName: raw.teamName ?? null,
    schoolOrigin: raw.schoolOrigin ?? null,
    currentBalance: toNumber(raw.currentBalance),
    startingBalance: toNumber(raw.startingBalance),
    broker: raw.broker
      ? {
          id: String(raw.broker?.id ?? ''),
          code: String(raw.broker?.code ?? raw.broker?.brokerCode ?? ''),
          name: String(raw.broker?.name ?? raw.broker?.brokerName ?? ''),
          feePercentage: toNumber(raw.broker?.feePercentage),
        }
      : null,
    lastLogin: raw.lastLogin ?? null,
    requiresBrokerSelection: Boolean(raw.requiresBrokerSelection ?? (!raw.broker || !raw.broker.id)),
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [authenticating, setAuthenticating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const data = await apiClient.get<{ user: any }>('/auth/me')
      setUser(normalizeUser(data.user))
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : 'Gagal memuat sesi pengguna')
      }
    } finally {
      setRefreshing(false)
      setInitializing(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      // refresh already handles errors above
    })
  }, [refresh])

  const login = useCallback(async (payload: LoginPayload) => {
    setAuthenticating(true)
    setError(null)
    try {
      const data = await apiClient.post<{ user: any }>('/auth/login', {
        ...payload,
        role: payload.role ?? 'participant',
      })
      const nextUser = normalizeUser(data.user)
      setUser(nextUser)
      return nextUser
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal masuk. Silakan coba lagi.'
      setError(message)
      throw err
    } finally {
      setAuthenticating(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<SessionContextValue>(() => ({
    user,
    loading: initializing || authenticating,
    error,
    refreshing,
    login,
    logout,
    refresh,
    clearError,
  }), [authenticating, clearError, error, initializing, login, logout, refresh, refreshing, user])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
