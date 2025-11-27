import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { NotificationProvider } from '@/components/notification-provider'
import { SessionProvider } from '@/components/session-provider'
import '@/lib/realtime-server'
import '@/lib/day-scheduler-bootstrap'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Pasar Modal Enterprise 5.0',
  description: 'Babak Pasar Modal EcoForce 2025',
  icons: {
    icon: [
      {
        url: '/favicon.png',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`font-sans antialiased`}>
        <SessionProvider>
          <NotificationProvider>
            {children}
            <Analytics />
          </NotificationProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
