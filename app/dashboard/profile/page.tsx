'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react'
import { useSession } from '@/components/session-provider'
import { apiClient, ApiError } from '@/lib/api-client'

type PortfolioSummary = {
  cashBalance: number
  totalInvestmentValue: number
  totalPortfolioValue: number
  totalReturn: number
  returnPercentage: number
}

type Holding = {
  id: string
  stockCode: string
  companyName: string
  quantity: number
  averageBuyPrice: number
  currentPrice: number
  totalEquity: number
  profitLoss: number
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

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

export default function ProfilePage() {
  const { user } = useSession()
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPortfolio = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ holdings: any[]; summary: any }>('/portfolio')
      setSummary({
        cashBalance: toNumber(response.summary?.cashBalance),
        totalInvestmentValue: toNumber(response.summary?.totalInvestmentValue),
        totalPortfolioValue: toNumber(response.summary?.totalPortfolioValue),
        totalReturn: toNumber(response.summary?.totalReturn),
        returnPercentage: toNumber(response.summary?.returnPercentage),
      })

      const normalized: Holding[] = (response.holdings ?? []).map((holding: any) => ({
        id: String(holding.id),
        stockCode: String(holding.stockCode ?? holding.company?.stockCode ?? ''),
        companyName: String(holding.companyName ?? holding.company?.companyName ?? holding.stockCode ?? ''),
        quantity: Number(holding.quantity ?? 0),
        averageBuyPrice: toNumber(holding.averageBuyPrice),
        currentPrice: toNumber(holding.currentPrice),
        totalEquity: toNumber(holding.totalEquity),
        profitLoss: toNumber(holding.profitLoss),
      }))
      setHoldings(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat portfolio'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPortfolio().catch(() => null)
  }, [fetchPortfolio])

  const pieData = holdings.map((holding) => ({ name: holding.stockCode, value: holding.totalEquity }))

  const hasHoldings = holdings.length > 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Saya</h1>
          <p className="text-gray-600">Kelola akun dan lihat performa portfolio</p>
        </div>
        <Button variant="ghost" onClick={fetchPortfolio} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />Segarkan
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informasi Akun</CardTitle>
          <CardDescription>Data pribadi dan pengaturan akun</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Username</p>
              <p className="font-semibold">{user?.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Nama Tim</p>
              <p className="font-semibold">{user?.teamName ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Asal Sekolah</p>
              <p className="font-semibold">{user?.schoolOrigin ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Broker</p>
              <p className="font-semibold">
                {user?.broker?.code} ({user?.broker?.name})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Saldo Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              Rp {Number(summary?.cashBalance ?? 0).toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Nilai Investasi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              Rp {Number(summary?.totalInvestmentValue ?? 0).toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              Rp {Number(summary?.totalPortfolioValue ?? 0).toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Return Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold flex items-center gap-2 ${Number(summary?.totalReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(summary?.totalReturn ?? 0) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              Rp {Math.abs(Number(summary?.totalReturn ?? 0)).toLocaleString('id-ID')}
            </p>
            <p className={`text-sm mt-1 ${Number(summary?.totalReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(summary?.returnPercentage ?? 0).toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Komposisi Saham</CardTitle>
          <CardDescription>Distribusi nilai ekuitas portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          {hasHoldings ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie dataKey="value" data={pieData} cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">Belum ada kepemilikan saham.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kepemilikan Saham</CardTitle>
          <CardDescription>Detail saham yang Anda miliki</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Kode</th>
                  <th className="text-left py-3 px-4 font-semibold">Perusahaan</th>
                  <th className="text-right py-3 px-4 font-semibold">Qty</th>
                  <th className="text-right py-3 px-4 font-semibold">Harga Saat Ini</th>
                  <th className="text-right py-3 px-4 font-semibold">Rata-rata Beli</th>
                  <th className="text-right py-3 px-4 font-semibold">Nilai</th>
                  <th className="text-right py-3 px-4 font-semibold">P/L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const percent = holding.averageBuyPrice > 0 ? ((holding.currentPrice - holding.averageBuyPrice) / holding.averageBuyPrice) * 100 : 0
                  return (
                    <tr key={holding.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-emerald-600">{holding.stockCode}</td>
                      <td className="py-3 px-4">{holding.companyName}</td>
                      <td className="py-3 px-4 text-right">{holding.quantity}</td>
                      <td className="py-3 px-4 text-right">Rp {Number(holding.currentPrice).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right">Rp {Number(holding.averageBuyPrice).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right font-semibold">Rp {Number(holding.totalEquity).toLocaleString('id-ID')}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {percent >= 0 ? '+' : ''}
                        {percent.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {loading && <p className="text-sm text-gray-500 mt-4">Memuat data portfolio...</p>}
        </CardContent>
      </Card>
    </div>
  )
}
