'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/components/session-provider'
import { useWebSocket } from '@/hooks/use-websocket'
import { useDashboardNotifications } from '@/components/dashboard/notification-provider'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, RefreshCcw, Loader2 } from 'lucide-react'

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

type CompanyPriceHistory = {
  stockCode: string
  name: string
  prices: { dayNumber: number; price: number; isActive?: boolean }[]
}

type BrokerOption = {
  id: string
  code: string
  name: string
  feePercentage: number
  interestRate: number
  description: string
}

const CHART_COLORS = ['#10B981', '#059669', '#34D399', '#22C55E', '#047857', '#A7F3D0']

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

export default function DashboardPage() {
  const { user, refresh } = useSession()
  const { subscribe } = useWebSocket()
  const { notifications } = useDashboardNotifications()
  const { toast } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [priceHistories, setPriceHistories] = useState<CompanyPriceHistory[]>([])
  const [currentDay, setCurrentDay] = useState(0)
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({})
  const [dayNotification, setDayNotification] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [brokerOptions, setBrokerOptions] = useState<BrokerOption[]>([])
  const [brokersLoading, setBrokersLoading] = useState(false)
  const [brokerError, setBrokerError] = useState<string | null>(null)
  const [selectedBroker, setSelectedBroker] = useState('')
  const [brokerSubmitting, setBrokerSubmitting] = useState(false)

  const needsBrokerSelection = Boolean(user) && (!user?.broker || user?.requiresBrokerSelection)

  const fetchDashboard = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const [dayControl, portfolio, companies] = await Promise.all([
        apiClient.get<{ currentDay: number; totalDays: number; isSimulationActive: boolean }>('/days/current'),
        apiClient.get<{ holdings: any[]; summary: any }>('/portfolio'),
        apiClient.get<{ companies: any[] }>('/companies'),
      ])

      const activeDay = Number(dayControl.currentDay ?? 0)
      setCurrentDay(activeDay)

      const summary: PortfolioSummary = {
        cashBalance: toNumber(portfolio.summary?.cashBalance),
        totalInvestmentValue: toNumber(portfolio.summary?.totalInvestmentValue),
        totalPortfolioValue: toNumber(portfolio.summary?.totalPortfolioValue),
        totalReturn: toNumber(portfolio.summary?.totalReturn),
        returnPercentage: toNumber(portfolio.summary?.returnPercentage),
      }
      setPortfolioSummary(summary)

      const normalizedHoldings: Holding[] = (portfolio.holdings ?? []).map((holding: any) => ({
        id: String(holding.id),
        stockCode: String(holding.stockCode ?? holding.company?.stockCode ?? ''),
        companyName: String(holding.companyName ?? holding.company?.companyName ?? holding.stockCode ?? ''),
        quantity: Number(holding.quantity ?? 0),
        averageBuyPrice: toNumber(holding.averageBuyPrice),
        currentPrice: toNumber(holding.currentPrice),
        totalEquity: toNumber(holding.totalEquity),
        profitLoss: toNumber(holding.profitLoss),
      }))
      setHoldings(normalizedHoldings)

      const priceData = await Promise.all(
        (companies.companies ?? []).map(async (company: any) => {
          const prices = await apiClient.get<{ stockCode: string; prices: any[] }>(`/companies/${company.stockCode}/prices`)
          const filteredPrices = (prices.prices ?? []).filter((price) => {
            const dayNumber = Number(price.dayNumber ?? price.day)
            const isActive = Boolean(price.isActive)
            if (activeDay <= 0) {
              return dayNumber === 0 || isActive
            }
            return isActive || dayNumber <= activeDay
          })

          return {
            stockCode: company.stockCode,
            name: company.name ?? company.companyName ?? company.stockCode,
            prices: filteredPrices.map((price) => ({
              dayNumber: Number(price.dayNumber ?? price.day),
              price: toNumber(price.price),
              isActive: Boolean(price.isActive),
            })),
          }
        })
      )

      setPriceHistories(priceData)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat data dashboard'
      setError(message)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!user || needsBrokerSelection) return
    fetchDashboard().catch(() => null)
  }, [fetchDashboard, needsBrokerSelection, user])

  useEffect(() => {
      if (!user || needsBrokerSelection) {
        return
      }

      const unsubscribePrice = subscribe('price_update', (data: { stockCode: string; price: number }) => {
        setPriceUpdates((prev) => ({
          ...prev,
          [data.stockCode]: data.price,
        }))
      })

      const unsubscribeDay = subscribe('day_changed', (data: { currentDay: number }) => {
        setDayNotification(`Hari ${data.currentDay} telah dimulai!`)
        setCurrentDay(data.currentDay)
        setPriceUpdates({})
        fetchDashboard().catch(() => null)
        setTimeout(() => setDayNotification(''), 5000)
      })

      return () => {
        unsubscribePrice()
        unsubscribeDay()
      }
    }, [fetchDashboard, needsBrokerSelection, subscribe, user])

  const priceChartData = useMemo(() => {
    const series = new Map<number, Record<string, number | string>>()

    priceHistories.forEach((company) => {
      company.prices
        .filter((point) => point.isActive || point.dayNumber <= currentDay)
        .forEach((point) => {
          const existing = series.get(point.dayNumber) ?? { day: point.dayNumber }
          existing[company.stockCode.toLowerCase()] = point.price
          series.set(point.dayNumber, existing)
        })
    })

    return Array.from(series.values()).sort((a, b) => (Number(a.day) ?? 0) - (Number(b.day) ?? 0))
  }, [currentDay, priceHistories])

  const stockTicker = useMemo(() => {
    return priceHistories.map((company) => {
      const sorted = [...company.prices].sort((a, b) => a.dayNumber - b.dayNumber)
      const availablePoints = sorted.filter((point) => point.isActive || point.dayNumber <= currentDay)
      const currentPriceRecord = availablePoints[availablePoints.length - 1] ?? sorted[0]
      const previousRecord = availablePoints.length > 1 ? availablePoints[availablePoints.length - 2] : currentPriceRecord

      const overriddenPrice = priceUpdates[company.stockCode]
      const currentPrice = overriddenPrice ?? currentPriceRecord?.price ?? 0
      const previousPrice = previousRecord?.price ?? currentPrice
      const change = currentPrice - previousPrice
      const changePct = previousPrice > 0 ? (change / previousPrice) * 100 : 0

      return {
        code: company.stockCode,
        name: company.name,
        price: currentPrice,
        change,
        changePct,
      }
    })
  }, [currentDay, priceHistories, priceUpdates])

  const portfolioPieData = useMemo(() => {
    const total = holdings.reduce((sum, holding) => sum + holding.totalEquity, 0)
    if (!total) return []
    return holdings.map((holding) => ({ name: holding.stockCode, value: holding.totalEquity }))
  }, [holdings])

  const hasHoldings = holdings.length > 0

  const fetchBrokers = useCallback(async () => {
    setBrokersLoading(true)
    setBrokerError(null)
    try {
      const response = await apiClient.get<{ brokers: BrokerOption[] }>('/brokers')
      const options = response.brokers ?? []
      setBrokerOptions(options)
      setSelectedBroker('')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat broker'
      setBrokerError(message)
    } finally {
      setBrokersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!needsBrokerSelection) return
    fetchBrokers().catch(() => null)
  }, [fetchBrokers, needsBrokerSelection])

  const handleBrokerSelection = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedBroker) {
      setBrokerError('Silakan pilih broker terlebih dahulu')
      return
    }

    setBrokerSubmitting(true)
    setBrokerError(null)
    try {
      await apiClient.post('/profile/broker', { brokerId: selectedBroker })
      toast({ title: 'Broker ditetapkan', description: 'Anda dapat melanjutkan ke dashboard.' })
      await refresh()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menetapkan broker'
      setBrokerError(message)
      toast({ title: 'Gagal menetapkan broker', description: message, variant: 'destructive' })
    } finally {
      setBrokerSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Memuat sesi...</CardTitle>
          </CardHeader>
          <CardContent>Silakan tunggu.</CardContent>
        </Card>
      </div>
    )
  }

  if (needsBrokerSelection) {
    return (
      <div className="p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Pilih Broker Anda</CardTitle>
            <CardDescription>
              Silakan pilih broker yang akan digunakan selama simulasi. Setelah disimpan, peserta tidak dapat mengubah broker tanpa bantuan admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleBrokerSelection}>
              {brokerError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {brokerError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Broker</label>
                <select
                  className="w-full rounded-md border px-3 py-2"
                  value={selectedBroker}
                  onChange={(event) => setSelectedBroker(event.target.value)}
                  disabled={brokersLoading || brokerSubmitting}
                >
                  <option value="" disabled>
                    {brokersLoading
                      ? 'Memuat daftar broker...'
                      : brokerOptions.length > 0
                        ? 'Pilih broker terlebih dahulu'
                        : 'Broker belum tersedia'}
                  </option>
                  {!brokersLoading &&
                    brokerOptions.map((broker) => (
                      <option key={broker.id} value={broker.id}>
                        {broker.code} • {broker.name} (Fee {broker.feePercentage.toFixed(2)}% | Bunga {broker.interestRate.toFixed(2)}%)
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500">
                  Jika daftar kosong, hubungi admin untuk menambahkan broker terlebih dahulu.
                </p>
              </div>

              {/* Info broker yang dipilih */}
              {selectedBroker && (() => {
                const broker = brokerOptions.find(b => b.id === selectedBroker)
                if (!broker) return null
                return (
                  <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 space-y-2">
                    <p className="font-semibold text-emerald-800">{broker.code} - {broker.name}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Fee Transaksi:</span>
                        <p className="font-semibold text-red-600">{broker.feePercentage.toFixed(2)}%</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Bunga Harian:</span>
                        <p className="font-semibold text-green-600">{broker.interestRate.toFixed(2)}%</p>
                      </div>
                    </div>
                    {broker.description && (
                      <p className="text-xs text-gray-600 mt-2">{broker.description}</p>
                    )}
                  </div>
                )
              })()}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={brokerSubmitting || brokersLoading || !selectedBroker}
                >
                  {brokerSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Simpan Broker
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {dayNotification && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded animate-pulse">
          🔔 {dayNotification}
        </div>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700 flex justify-between items-center">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => fetchDashboard()} disabled={refreshing}>
              <RefreshCcw className="mr-2 h-4 w-4" />Coba Lagi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Saldo Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              Rp {Number(portfolioSummary?.cashBalance ?? 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-gray-600 mt-1">Tersedia untuk transaksi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Nilai Investasi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              Rp {Number(portfolioSummary?.totalInvestmentValue ?? 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-gray-600 mt-1">Total saham yang dimiliki</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">
              Rp {Number(portfolioSummary?.totalPortfolioValue ?? 0).toLocaleString('id-ID')}
            </p>
            <p className={`text-xs mt-1 flex items-center gap-1 ${Number(portfolioSummary?.totalReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(portfolioSummary?.totalReturn ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Number(portfolioSummary?.totalReturn ?? 0) >= 0 ? '+' : '-'}
              Rp {Math.abs(Number(portfolioSummary?.totalReturn ?? 0)).toLocaleString('id-ID')} (
              {Number(portfolioSummary?.returnPercentage ?? 0).toFixed(2)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Nama Tim</p>
              <p className="font-semibold">{user.teamName ?? user.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Asal Sekolah</p>
              <p className="font-semibold">{user.schoolOrigin ?? '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Broker</p>
              <p className="font-semibold">
                {user.broker?.code} ({user.broker?.name})
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Fee Broker</p>
              <p className="font-semibold">{Number(user.broker?.feePercentage ?? 0).toFixed(2)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Harga Saham per Hari</CardTitle>
              <CardDescription>Pergerakan harga hingga hari {currentDay}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" label={{ value: 'Hari', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {priceHistories.map((company, index) => (
                    <Line
                      key={company.stockCode}
                      type="monotone"
                      dataKey={company.stockCode.toLowerCase()}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      name={company.stockCode}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Komposisi Portfolio</CardTitle>
            <CardDescription>Distribusi nilai ekuitas</CardDescription>
          </CardHeader>
          <CardContent>
            {hasHoldings ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={portfolioPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: Rp ${(value / 1_000_000).toFixed(1)}Jt`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {portfolioPieData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
      </div>

      {/* Stock Ticker */}
      <Card>
        <CardHeader>
          <CardTitle>Harga Saham Hari Ini</CardTitle>
          <CardDescription>Perubahan harga terbaru pada hari {currentDay}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {stockTicker.map((stock) => {
              const isPositive = stock.change >= 0
              return (
                <div key={stock.code} className="border rounded-lg p-4 text-center hover:bg-gray-50">
                  <p className="font-semibold text-emerald-600 mb-1">{stock.code}</p>
                  <p className="text-2xl font-bold">Rp {Number(stock.price).toLocaleString('id-ID')}</p>
                  <p className={`text-sm font-semibold mt-1 flex items-center justify-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {`${isPositive ? '+' : ''}${stock.changePct.toFixed(2)}%`}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-gray-500">Memuat data terbaru...</CardContent>
        </Card>
      )}
    </div>
  )
}
