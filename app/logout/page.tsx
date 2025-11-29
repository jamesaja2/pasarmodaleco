'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/components/session-provider'

export default function LogoutPage() {
  const { logout } = useSession()
  const [status, setStatus] = useState<'logging-out' | 'done'>('logging-out')

  useEffect(() => {
    const doLogout = async () => {
      try {
        await logout()
      } catch {
        // Ignore errors, proceed to quit anyway
      }
      setStatus('done')
      
      // Redirect to SEB quit link after short delay
      setTimeout(() => {
        window.location.href = 'sebs://quit'
      }, 500)
    }
    
    doLogout()
  }, [logout])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 text-center max-w-md">
        <div className="mb-4">
          {status === 'logging-out' ? (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          ) : (
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {status === 'logging-out' ? 'Sedang Logout...' : 'Logout Berhasil'}
        </h1>
        <p className="text-gray-600 text-sm">
          {status === 'logging-out' 
            ? 'Mohon tunggu sebentar...' 
            : 'Menutup Safe Exam Browser...'}
        </p>
      </div>
    </div>
  )
}
