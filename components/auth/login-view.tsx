'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/components/session-provider'

interface AlternateLink {
  href: string
  label: string
  description: string
}

interface LoginViewProps {
  role: 'admin' | 'participant'
  heading: string
  description: string
  alternate?: AlternateLink
  infoMessage?: string
}

export function LoginView({
  role,
  heading,
  description,
  alternate,
  infoMessage,
}: LoginViewProps) {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, loading: sessionLoading, user, error: sessionError, clearError } = useSession()

  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace(user.role === 'ADMIN' ? '/admin' : '/dashboard')
    }
  }, [router, sessionLoading, user])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    clearError()

    try {
      const nextUser = await login({ username, password, role })
      router.replace(nextUser.role === 'ADMIN' ? '/admin' : '/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal login, periksa kembali kredensial Anda.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const isBusy = submitting || sessionLoading

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Image
              src="/brand-logo.png"
              alt="Logo"
              width={200}
              height={60}
              priority
              className="h-16 w-auto"
            />
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>{heading}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || sessionError) && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error ?? sessionError}
                </div>
              )}

              {infoMessage && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {infoMessage}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    if (error) setError(null)
                    if (sessionError) clearError()
                  }}
                  required
                  disabled={isBusy}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (error) setError(null)
                    if (sessionError) clearError()
                  }}
                  required
                  disabled={isBusy}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isBusy}
              >
                {isBusy ? 'Memproses...' : 'Login'}
              </Button>
            </form>

            {alternate && (
              <p className="text-xs text-gray-600 mt-4 text-center">
                {alternate.description}{' '}
                <Link href={alternate.href} className="text-emerald-600 hover:underline">
                  {alternate.label}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 mt-6">
          Enterprise 5.0 © 2025 Made with ❤️ by James All Rights Reserved
        </p>
      </div>
    </div>
  )
}
