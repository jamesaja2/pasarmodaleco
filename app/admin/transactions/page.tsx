'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient, ApiError } from '@/lib/api-client'

type Transaction = {
  id: string
  username: string
  teamName: string
  broker: { id: string; code: string; name: string }
  company: { id: string; stockCode: string; name: string }
  dayNumber: number
  type: 'BUY' | 'SELL'
  quantity: number
  pricePerShare: number
  totalAmount: number
  brokerFee: number
  timestamp: string
  status: string
}

type FilterState = {
  username: string
  stock: string
  type: 'ALL' | 'BUY' | 'SELL'
  day: string
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return 'Rp 0'
  return `Rp ${value.toLocaleString('id-ID')}`
}

function formatTime(timestamp: string) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function toCsv(rows: Transaction[]) {
  if (!rows.length) return ''
  const headers = ['Username', 'Tim', 'Broker', 'Saham', 'Hari', 'Tipe', 'Qty', 'Harga', 'Total', 'Fee', 'Status', 'Timestamp']
  const body = rows
    .map((row) => [
      row.username,
      row.teamName,
      `${row.broker.code} - ${row.broker.name}`,
      `${row.company.stockCode} - ${row.company.name}`,
      row.dayNumber,
      row.type,
      row.quantity,
      row.pricePerShare,
      row.totalAmount,
      row.brokerFee,
      row.status,
      row.timestamp,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return `${headers.join(',')}\n${body}`
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<FilterState>({ username: '', stock: '', type: 'ALL', day: '' })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchTransactions = useCallback(async (controller?: AbortController) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.username) params.set('username', filters.username)
      if (filters.stock) params.set('stock', filters.stock)
      if (filters.type !== 'ALL') params.set('type', filters.type)
      if (filters.day) params.set('day', filters.day)
      params.set('limit', '200')

      const response = await apiClient.get<{ transactions: Transaction[]; total: number }>(`/admin/transactions?${params.toString()}`, { signal: controller?.signal })
      setTransactions(response.transactions)
      setTotal(response.total)
    } catch (err) {
      if (controller?.signal.aborted) return
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat transaksi'
      setError(message)
      setTransactions([])
      setTotal(0)
    } finally {
      if (!controller?.signal.aborted) {
        setLoading(false)
      }
    }
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      fetchTransactions(controller).catch(() => null)
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [fetchTransactions])

  const handleExport = useCallback(() => {
    if (!transactions.length) return
    setExporting(true)
    try {
      const csv = toCsv(transactions)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'admin-transactions.csv')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }, [transactions])

  const filteredCount = useMemo(() => transactions.length, [transactions])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Log Transaksi</h1>
          <p className="text-gray-600">Lihat semua transaksi yang dilakukan peserta</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExport} disabled={!transactions.length || exporting}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Username..."
              value={filters.username}
              onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
            />
            <Input
              placeholder="Kode Saham..."
              value={filters.stock}
              onChange={(e) => setFilters((prev) => ({ ...prev, stock: e.target.value }))}
            />
            <Input
              placeholder="Hari Simulasi..."
              type="number"
              min={1}
              value={filters.day}
              onChange={(e) => setFilters((prev) => ({ ...prev, day: e.target.value }))}
            />
            <select
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as FilterState['type'] }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="BUY">Beli</option>
              <option value="SELL">Jual</option>
            </select>
            <Button variant="outline" onClick={() => fetchTransactions().catch(() => null)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi</CardTitle>
          <CardDescription>{filteredCount} transaksi ditampilkan dari total {total}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Username</th>
                  <th className="text-left py-3 px-4 font-semibold">Tim</th>
                  <th className="text-left py-3 px-4 font-semibold">Broker</th>
                  <th className="text-left py-3 px-4 font-semibold">Saham</th>
                  <th className="text-center py-3 px-4 font-semibold">Tipe</th>
                  <th className="text-right py-3 px-4 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Harga</th>
                  <th className="text-right py-3 px-4 font-semibold">Total</th>
                  <th className="text-right py-3 px-4 font-semibold">Fee</th>
                  <th className="text-center py-3 px-4 font-semibold">Jam</th>
                </tr>
              </thead>
              <tbody>
                {loading && !transactions.length ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Memuat transaksi...
                      </div>
                    </td>
                  </tr>
                ) : transactions.length ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold">{tx.username}</td>
                      <td className="py-3 px-4">{tx.teamName || '-'}</td>
                      <td className="py-3 px-4">{tx.broker.code}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-600">{tx.company.stockCode}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tx.type === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type === 'BUY' ? 'Beli' : 'Jual'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">{tx.quantity.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(tx.pricePerShare)}</td>
                      <td className="py-3 px-4 text-right font-semibold">{formatCurrency(tx.totalAmount)}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatCurrency(tx.brokerFee)}</td>
                      <td className="py-3 px-4 text-center">{formatTime(tx.timestamp)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-gray-500">{error ? 'Tidak dapat memuat transaksi.' : 'Belum ada transaksi.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
