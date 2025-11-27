'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw, ShoppingCart, TrendingDown } from 'lucide-react'
import { TransactionBuySellForm } from '@/components/forms/transaction-buy-sell-form'
import { apiClient, ApiError } from '@/lib/api-client'
import { useSession } from '@/components/session-provider'
import { useToast } from '@/hooks/use-toast'

type StockRow = {
  code: string
  name: string
  price: number
  ownedShares: number
  ownedLots: number
  equity: number
}

type TransactionHistoryItem = {
  id: string
  dayNumber: number
  stockCode: string
  transactionType: 'BUY' | 'SELL'
  quantity: number
  pricePerShare: number
  totalAmount: number
  brokerFee: number
  timestamp: string
  status: string
}

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

export default function TransactionPage() {
  const { user } = useSession()
  const { toast } = useToast()

  const [stocks, setStocks] = useState<StockRow[]>([])
  const [history, setHistory] = useState<TransactionHistoryItem[]>([])
  const [currentBalance, setCurrentBalance] = useState(0)
  const [currentDay, setCurrentDay] = useState(0)
  const [simulationActive, setSimulationActive] = useState(false)
  const [tradedStockCodes, setTradedStockCodes] = useState<string[]>([])
  const [selectedStock, setSelectedStock] = useState<StockRow | null>(null)
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy')
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const brokerFee = useMemo(() => Number(user?.broker?.feePercentage ?? 0), [user?.broker?.feePercentage])

  const fetchData = useCallback(async () => {
    setLoadingPage(true)
    setError(null)
    try {
      const [dayControl, portfolio, companies, todayTx] = await Promise.all([
        apiClient.get<{ currentDay: number; isSimulationActive: boolean }>('/days/current'),
        apiClient.get<{ summary: any; holdings: any[] }>('/portfolio'),
        apiClient.get<{ companies: any[] }>('/companies'),
        apiClient.get<{ tradedStockCodes?: string[] }>('/transactions/today'),
      ])

      setCurrentDay(Number(dayControl.currentDay ?? 0))
      setSimulationActive(Boolean(dayControl.isSimulationActive))
      setCurrentBalance(toNumber(portfolio.summary?.cashBalance))
      setTradedStockCodes(todayTx.tradedStockCodes ?? [])

      const holdingByCode = new Map(
        (portfolio.holdings ?? []).map((holding) => [String(holding.stockCode ?? holding.company?.stockCode ?? ''), holding])
      )

      const stockRows = await Promise.all(
        (companies.companies ?? []).map(async (company: any) => {
          const code = String(company.stockCode)
          let currentPrice = 0
          try {
            const priceData = await apiClient.get<any>(`/companies/${code}/prices?day=${dayControl.currentDay ?? 0}`)
            currentPrice = priceData?.price != null ? Number(priceData.price) : Number(priceData?.prices?.at(-1)?.price ?? 0)
          } catch (priceError) {
            console.warn(`Gagal memuat harga untuk ${code}`, priceError)
          }
          const holding = holdingByCode.get(code)
          const ownedShares = Number(holding?.quantity ?? 0)
          const ownedLots = ownedShares / 100
          return {
            code,
            name: String(company.name ?? company.companyName ?? code),
            price: currentPrice,
            ownedShares,
            ownedLots,
            equity: currentPrice * ownedShares,
          }
        })
      )

      setStocks(stockRows)

      const historyResponse = await apiClient.get<{ transactions: any[] }>(`/transactions/history?day=${dayControl.currentDay ?? 0}`)
      const normalizedHistory: TransactionHistoryItem[] = (historyResponse.transactions ?? []).map((item) => ({
        id: String(item.id),
        dayNumber: Number(item.dayNumber ?? 0),
        stockCode: String(item.stockCode ?? ''),
        transactionType: (item.transactionType as 'BUY' | 'SELL') ?? 'BUY',
        quantity: Number(item.quantity ?? 0),
        pricePerShare: Number(item.pricePerShare ?? 0),
        totalAmount: Number(item.totalAmount ?? 0),
        brokerFee: Number(item.brokerFee ?? 0),
        timestamp: item.timestamp ?? new Date().toISOString(),
        status: String(item.status ?? ''),
      }))
      setHistory(normalizedHistory)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat data transaksi'
      setError(message)
    } finally {
      setLoadingPage(false)
    }
  }, [])

  useEffect(() => {
    fetchData().catch(() => null)
  }, [fetchData])

  const openBuyModal = (stock: StockRow) => {
    setSelectedStock(stock)
    setTransactionType('buy')
    setShowForm(true)
  }

  const openSellModal = (stock: StockRow) => {
    setSelectedStock(stock)
    setTransactionType('sell')
    setShowForm(true)
  }

  const handleTransactionSubmit = async (data: { stockCode: string; quantity: number; type: 'buy' | 'sell' }) => {
    setIsLoading(true)
    setError(null)
    try {
      await apiClient.post('/transactions/execute', {
        transactions: [
          {
            stockCode: data.stockCode,
            quantity: Number(data.quantity),
            type: data.type === 'buy' ? 'BUY' : 'SELL',
          },
        ],
      })

      const lots = data.quantity / 100
      toast({
        title: 'Transaksi berhasil',
        description: `${data.type === 'buy' ? 'Pembelian' : 'Penjualan'} ${lots.toLocaleString('id-ID')} lot ${data.stockCode} telah diproses.`,
      })

      setShowForm(false)
      setSelectedStock(null)
      await fetchData()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Transaksi gagal diproses'
      setError(message)
      toast({
        title: 'Transaksi gagal',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transaksi Saham</h1>
          <p className="text-gray-600">Lakukan transaksi beli/jual saham untuk hari {currentDay}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loadingPage}>
          <RefreshCcw className="mr-2 h-4 w-4" />Segarkan
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tabel Transaksi Hari {currentDay}</CardTitle>
          <CardDescription>
            Broker: {user?.broker?.code} ({brokerFee.toFixed(2)}% fee) | Saldo Tersedia: Rp {Number(currentBalance).toLocaleString('id-ID')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!simulationActive && (
            <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              Simulasi belum aktif. Transaksi akan tersedia saat hari berjalan dimulai.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">Kode</th>
                  <th className="text-left py-3 px-4 font-semibold">Perusahaan</th>
                  <th className="text-right py-3 px-4 font-semibold">Harga (Rp)</th>
                  <th className="text-right py-3 px-4 font-semibold">Dimiliki</th>
                  <th className="text-right py-3 px-4 font-semibold">Total Ekuitas</th>
                  <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock) => {
                  const alreadyTraded = tradedStockCodes.includes(stock.code)
                  return (
                    <tr key={stock.code} className={`border-b border-gray-100 hover:bg-gray-50 ${alreadyTraded ? 'bg-gray-50 opacity-60' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-emerald-600">{stock.code}</td>
                      <td className="py-3 px-4">
                        {stock.name}
                        {alreadyTraded && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            Sudah transaksi hari ini
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">Rp {Number(stock.price).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-right">{stock.ownedLots.toLocaleString('id-ID')} lot</td>
                      <td className="py-3 px-4 text-right font-semibold">Rp {Number(stock.equity).toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-center flex justify-center gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openBuyModal(stock)}
                          disabled={!simulationActive || alreadyTraded}
                          title={alreadyTraded ? 'Sudah transaksi hari ini' : ''}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Beli
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => openSellModal(stock)}
                          disabled={!simulationActive || stock.ownedShares < 100 || alreadyTraded}
                          title={alreadyTraded ? 'Sudah transaksi hari ini' : ''}
                        >
                          <TrendingDown className="w-4 h-4 mr-1" />
                          Jual
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {!loadingPage && stocks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-gray-500">
                      Tidak ada data perusahaan yang tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {loadingPage && <p className="text-sm text-gray-500 mt-4">Memuat daftar saham...</p>}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Transaksi</CardTitle>
            <CardDescription>{history.length} transaksi pada hari {currentDay}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((tx) => {
                const isBuy = tx.transactionType === 'BUY'
                const date = new Date(tx.timestamp)
                return (
                  <div key={tx.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded ${isBuy ? 'bg-green-100' : 'bg-red-100'}`}>
                        {isBuy ? (
                          <ShoppingCart className="w-5 h-5 text-green-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {isBuy ? 'Beli' : 'Jual'} {(tx.quantity / 100).toLocaleString('id-ID')} lot {tx.stockCode}
                        </p>
                        <p className="text-xs text-gray-600">
                          {date.toLocaleDateString('id-ID')} • {date.toLocaleTimeString('id-ID')} • Status: {tx.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Rp {Number(tx.totalAmount).toLocaleString('id-ID')}</p>
                      <p className="text-xs text-gray-600">Fee: Rp {Number(tx.brokerFee).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedStock && (
        <TransactionBuySellForm
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setSelectedStock(null)
          }}
          stock={selectedStock}
          transactionType={transactionType}
          currentBalance={currentBalance}
          brokerFee={brokerFee}
          onSubmit={handleTransactionSubmit}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
