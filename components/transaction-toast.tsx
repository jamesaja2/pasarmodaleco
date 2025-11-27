'use client'

import { useTransactionUpdates } from '@/hooks/use-transaction-updates'
import { CheckCircle, AlertCircle, Loader } from 'lucide-react'

export function TransactionToast() {
  const { updates } = useTransactionUpdates()

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {updates.map((update) => (
        <div
          key={update.id}
          className={`flex items-center gap-3 p-4 rounded-lg shadow-lg animate-in ${
            update.type === 'success' ? 'bg-green-50 border border-green-200' :
            update.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-emerald-50 border border-emerald-200'
          }`}
        >
          {update.status === 'pending' && (
            <Loader className="w-5 h-5 text-emerald-600 animate-spin" />
          )}
          {update.status === 'completed' && (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          {update.status === 'failed' && (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <div>
            <p className="text-sm font-semibold">{update.message}</p>
            <p className="text-xs text-gray-600">{update.status}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
