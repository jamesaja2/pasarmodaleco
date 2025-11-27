'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { LayoutGrid, Building2, Newspaper, Users, Calendar, FileText, Briefcase, Settings, LogOut, Menu, X, Clock } from 'lucide-react'
import { useSession } from '@/components/session-provider'

const menuItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid },
  { href: '/admin/companies', label: 'Perusahaan', icon: Building2 },
  { href: '/admin/news', label: 'Berita', icon: Newspaper },
  { href: '/admin/participants', label: 'Peserta', icon: Users },
  { href: '/admin/days', label: 'Kontrol Hari', icon: Calendar },
  { href: '/admin/transactions', label: 'Log Transaksi', icon: FileText },
  { href: '/admin/brokers', label: 'Broker', icon: Briefcase },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings },
]

export default function AdminLayout({
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
    if (!loading) {
      if (!user) {
        router.replace('/login/admin')
      } else if (user.role !== 'ADMIN') {
        router.replace('/dashboard')
      }
    }
  }, [loading, router, user])

  const activeHref = useMemo(() => pathname ?? '', [pathname])

  const handleLogout = async () => {
    await logout()
    router.replace('/login/admin')
  }

  return (
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap ${activeHref === item.href ? 'bg-emerald-800 text-white' : 'hover:bg-emerald-800'}`}
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Clock className="w-4 h-4" />
              {serverTime.toLocaleTimeString('id-ID')} WIB
            </div>
            {user && (
              <div className="hidden sm:flex flex-col text-right text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{user.username}</span>
                <span>Admin</span>
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
  )
}
