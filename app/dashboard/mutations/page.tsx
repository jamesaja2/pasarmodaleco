'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Percent, 
  Newspaper, 
  RefreshCcw, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter
} from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'

type MutationEntry = {
  id: string
  type: 'TRANSACTION_BUY' | 'TRANSACTION_SELL' | 'INTEREST' | 'NEWS_PURCHASE'
  dayNumber: number
  description: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  timestamp: string
  details?: {
    stockCode?: string
    quantity?: number
    pricePerShare?: number
    brokerFee?: number
    interestRate?: number
    portfolioValue?: number
    newsTitle?: string
  }
}

type MutationSummary = {
  totalBuys: number
  totalSells: number
  totalInterest: number
  totalNewsPurchases: number
  transactionCount: number
  interestCount: number
}

type FilterType = 'all' | 'TRANSACTION_BUY' | 'TRANSACTION_SELL' | 'INTEREST' | 'NEWS_PURCHASE'

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMutationIcon(type: MutationEntry['type']) {
  switch (type) {
    case 'TRANSACTION_BUY':
      return <ArrowDownCircle className="w-5 h-5 text-red-500" />
    case 'TRANSACTION_SELL':
      return <ArrowUpCircle className="w-5 h-5 text-green-500" />
    case 'INTEREST':
      return <Percent className="w-5 h-5 text-blue-500" />
    case 'NEWS_PURCHASE':
      return <Newspaper className="w-5 h-5 text-orange-500" />
  }
}

function getMutationBadge(type: MutationEntry['type']) {
  switch (type) {
    case 'TRANSACTION_BUY':
      return <Badge className="bg-red-100 text-red-800">Beli Saham</Badge>
    case 'TRANSACTION_SELL':
      return <Badge className="bg-green-100 text-green-800">Jual Saham</Badge>
    case 'INTEREST':
      return <Badge className="bg-blue-100 text-blue-800">Bunga</Badge>
    case 'NEWS_PURCHASE':
      return <Badge className="bg-orange-100 text-orange-800">Beli Berita</Badge>
  }
}

export default function MutationsPage() {
  const [mutations, setMutations] = useState<MutationEntry[]>([])
  const [summary, setSummary] = useState<MutationSummary | null>(null)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [startingBalance, setStartingBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')

  const fetchMutations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{
        mutations: MutationEntry[]
        summary: MutationSummary
        currentBalance: number
        startingBalance: number
      }>('/mutations')
      setMutations(response.mutations)
      setSummary(response.summary)
      setCurrentBalance(response.currentBalance)
      setStartingBalance(response.startingBalance)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat mutasi'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMutations().catch(() => null)
  }, [fetchMutations])

  const filteredMutations = useMemo(() => {
    if (filter === 'all') return mutations
    return mutations.filter((m) => m.type === filter)
  }, [mutations, filter])

  const totalChange = currentBalance - startingBalance
  const percentChange = startingBalance > 0 ? ((totalChange / startingBalance) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mutasi Rekening</h1>
          <p className="text-gray-600">Riwayat lengkap perubahan saldo akun Anda</p>
        </div>
        <Button variant="outline" onClick={fetchMutations} disabled={loading}>
          <RefreshCcw className="w-4 h-4 mr-2" />
          Segarkan
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo Awal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(startingBalance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Saldo Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(currentBalance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              {totalChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              Perubahan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalChange >= 0 ? '+' : ''}{formatCurrency(totalChange)}
            </p>
            <p className={`text-sm ${totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Total Bunga
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary?.totalInterest ?? 0)}
            </p>
            <p className="text-sm text-gray-500">{summary?.interestCount ?? 0} kali</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500" />
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Semua
            </Button>
            <Button
              size="sm"
              variant={filter === 'TRANSACTION_BUY' ? 'default' : 'outline'}
              onClick={() => setFilter('TRANSACTION_BUY')}
              className={filter === 'TRANSACTION_BUY' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Beli Saham
            </Button>
            <Button
              size="sm"
              variant={filter === 'TRANSACTION_SELL' ? 'default' : 'outline'}
              onClick={() => setFilter('TRANSACTION_SELL')}
              className={filter === 'TRANSACTION_SELL' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Jual Saham
            </Button>
            <Button
              size="sm"
              variant={filter === 'INTEREST' ? 'default' : 'outline'}
              onClick={() => setFilter('INTEREST')}
              className={filter === 'INTEREST' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Bunga
            </Button>
            <Button
              size="sm"
              variant={filter === 'NEWS_PURCHASE' ? 'default' : 'outline'}
              onClick={() => setFilter('NEWS_PURCHASE')}
              className={filter === 'NEWS_PURCHASE' ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              Beli Berita
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mutations List */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Mutasi</CardTitle>
          <CardDescription>
            {filteredMutations.length} entri {filter !== 'all' ? `(filter: ${filter.replace('TRANSACTION_', '').replace('_', ' ')})` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : filteredMutations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Belum ada mutasi yang tercatat.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMutations.map((mutation) => (
                <div
                  key={mutation.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getMutationIcon(mutation.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getMutationBadge(mutation.type)}
                      <span className="text-xs text-gray-500">Hari {mutation.dayNumber}</span>
                    </div>
                    <p className="font-medium text-gray-900">{mutation.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(mutation.timestamp)}</p>
                    
                    {/* Details */}
                    {mutation.details && (
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        {mutation.details.stockCode && (
                          <p>
                            Saham: <span className="font-semibold text-emerald-600">{mutation.details.stockCode}</span>
                            {mutation.details.quantity && ` • ${mutation.details.quantity} lot`}
                            {mutation.details.pricePerShare && ` @ ${formatCurrency(mutation.details.pricePerShare)}`}
                          </p>
                        )}
                        {mutation.details.brokerFee !== undefined && mutation.details.brokerFee > 0 && (
                          <p>Fee broker: {formatCurrency(mutation.details.brokerFee)}</p>
                        )}
                        {mutation.details.interestRate !== undefined && (
                          <p>
                            Bunga: {mutation.details.interestRate.toFixed(2)}% dari portofolio{' '}
                            {mutation.details.portfolioValue && formatCurrency(mutation.details.portfolioValue)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${mutation.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {mutation.amount >= 0 ? '+' : ''}{formatCurrency(mutation.amount)}
                    </p>
                    {mutation.balanceAfter > 0 && (
                      <p className="text-xs text-gray-500">
                        Saldo: {formatCurrency(mutation.balanceAfter)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
