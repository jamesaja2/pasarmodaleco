'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Newspaper, TrendingUp as Trending2, User, LogOut, Menu, X, Clock, Bell, Building2, Receipt } from 'lucide-react'
import { useSession } from '@/components/session-provider'
import { DashboardNotificationProvider, useDashboardNotifications } from '@/components/dashboard/notification-provider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/dashboard/companies', label: 'Perusahaan', icon: Building2 },
  { href: '/dashboard/news', label: 'Berita', icon: Newspaper },
  { href: '/dashboard/transaction', label: 'Transaksi', icon: Trending2 },
  { href: '/dashboard/mutations', label: 'Mutasi', icon: Receipt },
  { href: '/dashboard/profile', label: 'Portfolio', icon: User },
]

function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useDashboardNotifications()
  const [open, setOpen] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      markAllRead()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-800">Notifikasi</p>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700">
              Bersihkan
            </Button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada notifikasi.</p>
          ) : (
            notifications.map((notification) => {
              const timestamp = notification.timestamp ? new Date(notification.timestamp) : null
              return (
                <div key={notification.id} className="border border-gray-100 rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{notification.title}</p>
                    {notification.type ? (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {notification.type}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">{notification.message}</p>
                  {timestamp ? (
                    <p className="text-[11px] text-gray-400 mt-2">
                      {timestamp.toLocaleString('id-ID')}
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [serverTime, setServerTime] = useState(new Date())
  const { user, loading, logout } = useSession()

  useEffect(() => {
    const interval = setInterval(() => {
      setServerTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login/participant')
    }
  }, [loading, router, user])

  const activeHref = useMemo(() => pathname ?? '', [pathname])

  const handleLogout = async () => {
    await logout()
    // Redirect to SEB quit link to close Safe Exam Browser
    window.location.href = 'sebs://quit'
  }

  return (
    <DashboardNotificationProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-emerald-900 text-white transition-all duration-300 overflow-hidden flex flex-col`}>
          {/* Logo */}
          <div className="p-4 border-b border-emerald-800">
            <Image
              src="/brand-logo.png"
              alt="Pasar Modal"
              width={144}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive =
                activeHref === item.href ||
                (item.href !== '/dashboard' && activeHref?.startsWith(`${item.href}/`))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${isActive ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-800'}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-emerald-800 space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-emerald-800"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Dashboard Peserta</h2>
            </div>
            <div className="flex items-center gap-6">
              {user && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-xs text-emerald-600 font-medium">Saldo:</span>
                  <span className="text-sm font-bold text-emerald-700">
                    Rp {Number(user.currentBalance).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Clock className="w-4 h-4" />
                {serverTime.toLocaleTimeString('id-ID')} WIB
              </div>
              <NotificationBell />
              {user && (
                <div className="hidden sm:flex flex-col text-right text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{user.teamName ?? user.username}</span>
                  <span>{user.broker?.code ?? '-'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      </div>
    </DashboardNotificationProvider>
  )
}
