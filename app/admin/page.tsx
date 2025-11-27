'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, TrendingUp, DollarSign, Activity, Loader2, AlertTriangle } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'

const COLORS = ['#10B981', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6']

type OverviewResponse = {
  participants: { total: number; active: number }
  transactions: { total: number; today: number; volume: number }
  simulation: { currentDay: number; totalDays: number; isSimulationActive: boolean }
  charts: {
    transactionsByDay: Array<{ dayNumber: number; count: number; volume: number }>
    stockPopularity: Array<{ stockCode: string; companyName: string; transactions: number }>
  }
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return 'Rp 0'
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}T`
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(1)}K`
  }
  return `Rp ${value.toLocaleString('id-ID')}`
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<OverviewResponse>('/admin/overview')
      setOverview(response)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat ringkasan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview().catch(() => null)
  }, [fetchOverview])

  const transactionTrend = useMemo(() => overview?.charts.transactionsByDay ?? [], [overview])
  const stockPopularity = useMemo(() => overview?.charts.stockPopularity ?? [], [overview])

  return (
    <div className="p-6 space-y-6">
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Peserta</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-500" /> : overview?.participants.total ?? 0}
            </div>
            <p className="text-xs text-gray-600">Aktif: {overview?.participants.active ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-green-600" /> : overview?.transactions.total ?? 0}
            </div>
            <p className="text-xs text-gray-600">Hari ini: {overview?.transactions.today ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Trading</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-amber-600" /> : formatCurrency(overview?.transactions.volume ?? 0)}
            </div>
            <p className="text-xs text-gray-600">Akumulasi seluruh transaksi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Simulasi</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            ) : (
              <div className="space-y-1 text-sm">
                <p>Hari: {overview?.simulation.currentDay ?? 0} / {overview?.simulation.totalDays ?? 0}</p>
                <p>Status: {overview?.simulation.isSimulationActive ? 'Aktif' : 'Tidak aktif'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tren Transaksi</CardTitle>
            <CardDescription>Jumlah transaksi per hari simulasi</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : transactionTrend.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">Belum ada data transaksi.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={transactionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayNumber" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toLocaleString('id-ID')} labelFormatter={(label) => `Hari ${label}`} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#10B981" name="Jumlah Transaksi" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stock Popularity */}
        <Card>
          <CardHeader>
            <CardTitle>Saham Populer</CardTitle>
            <CardDescription>Jumlah transaksi per saham</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
              </div>
            ) : stockPopularity.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">Belum ada transaksi saham.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stockPopularity}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ stockCode, transactions }) => `${stockCode}: ${transactions}`}
                    outerRadius={80}
                    dataKey="transactions"
                  >
                    {stockPopularity.map((entry, index) => (
                      <Cell key={`cell-${entry.stockCode}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, _name, payload) => [`${value} transaksi`, payload?.payload?.companyName ?? '']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Volume Trading</CardTitle>
            <CardDescription>Volume transaksi per hari simulasi</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
              </div>
            ) : transactionTrend.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">Belum ada data volume.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={transactionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayNumber" />
                  <YAxis tickFormatter={(value) => `${(value / 1_000_000).toFixed(0)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Hari ${label}`} />
                  <Bar dataKey="volume" fill="#10B981" name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Status Simulasi</CardTitle>
            <CardDescription>Informasi umum sistem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Hari Simulasi Saat Ini</p>
                  <p className="text-3xl font-bold text-emerald-600">Hari {overview?.simulation.currentDay ?? 0}</p>
                                  <p className="text-3xl font-bold text-emerald-600">Hari {overview?.simulation.currentDay ?? 0}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Total Hari</p>
                  <p className="text-2xl font-bold">{overview?.simulation.totalDays ?? 0}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${overview?.simulation.isSimulationActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <p className="font-semibold">{overview?.simulation.isSimulationActive ? 'Aktif' : 'Tidak aktif'}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
