'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Lock, DollarSign, CheckCircle, RefreshCcw, Newspaper, Calendar, Building2, X, Shuffle } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useSession } from '@/components/session-provider'

type NewsFilter = 'all' | 'free' | 'paid'

type NewsItem = {
  id: string
  title: string
  preview: string
  content?: string
  dayNumber: number
  isPaid: boolean
  price: number | null
  companyCode: string | null
  publishedAt: string
  isPurchased: boolean
  isHidden?: boolean
}

type PaidNewsStatus = {
  currentDay: number
  maxPaidNewsPerDay: number
  paidNewsPrice: number
  purchasedToday: number
  remainingPurchases: number
  availableNews: number
}

function formatDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(date: string) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function NewsPage() {
  const { user, refresh } = useSession()
  const [filter, setFilter] = useState<NewsFilter>('all')
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [paidNewsStatus, setPaidNewsStatus] = useState<PaidNewsStatus | null>(null)
  const [randomPurchaseLoading, setRandomPurchaseLoading] = useState(false)

  const fetchPaidNewsStatus = useCallback(async () => {
    try {
      const status = await apiClient.get<PaidNewsStatus>('/news/purchase-random')
      setPaidNewsStatus(status)
    } catch {
      // Ignore errors for status fetch
    }
  }, [])

  const fetchNews = useCallback(async (currentFilter: NewsFilter) => {
    setLoading(true)
    setError(null)
    try {
      const query = currentFilter === 'all' ? '' : `?type=${currentFilter}`
      const response = await apiClient.get<{ news: any[] }>(`/news${query}`)
      const normalized: NewsItem[] = (response.news ?? []).map((item) => ({
        id: String(item.id),
        title: String(item.title),
        preview: String(item.preview ?? ''),
        dayNumber: Number(item.dayNumber ?? 0),
        isPaid: Boolean(item.isPaid),
        price: item.price != null ? Number(item.price) : null,
        companyCode: item.companyCode ?? null,
        publishedAt: item.publishedAt ?? new Date().toISOString(),
        isPurchased: Boolean(item.isPurchased),
        isHidden: Boolean(item.isHidden),
      }))
      setNewsItems(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat berita'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews(filter).catch(() => null)
    fetchPaidNewsStatus().catch(() => null)
  }, [fetchNews, fetchPaidNewsStatus, filter])

  // Handle random paid news purchase
  const handleRandomPurchase = useCallback(async () => {
    if (!user || user.role !== 'PARTICIPANT') return
    setRandomPurchaseLoading(true)
    setError(null)
    try {
      const result = await apiClient.post<{ news: any; remainingPurchases: number }>('/news/purchase-random')
      // Refresh news list and status
      await Promise.all([fetchNews(filter), fetchPaidNewsStatus(), refresh()])
      // Show the purchased news
      if (result.news) {
        const purchasedNews: NewsItem = {
          id: result.news.id,
          title: result.news.title,
          preview: '',
          content: result.news.content,
          dayNumber: result.news.dayNumber,
          isPaid: true,
          price: paidNewsStatus?.paidNewsPrice ?? 0,
          companyCode: null,
          publishedAt: new Date().toISOString(),
          isPurchased: true,
          isHidden: false,
        }
        setSelectedNews(purchasedNews)
        setDialogOpen(true)
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal membeli berita'
      setError(message)
    } finally {
      setRandomPurchaseLoading(false)
    }
  }, [user, filter, fetchNews, fetchPaidNewsStatus, refresh, paidNewsStatus])

  const handleOpenNews = useCallback(
    async (item: NewsItem) => {
      // For hidden paid news, don't open dialog - use random purchase instead
      if (item.isHidden) {
        return
      }
      
      setSelectedNews(item)
      setDialogOpen(true)

      // If content not loaded yet and accessible, fetch it
      if (!item.content && (!item.isPaid || item.isPurchased)) {
        setContentLoading(true)
        try {
          const detail = await apiClient.get<any>(`/news/${item.id}`)
          const updatedItem = {
            ...item,
            content: detail.content ?? detail.preview ?? item.preview,
            isPurchased: Boolean(detail.isPurchased ?? item.isPurchased),
          }
          setSelectedNews(updatedItem)
          setNewsItems((prev) =>
            prev.map((n) => (n.id === item.id ? updatedItem : n))
          )
        } catch (err) {
          console.error('Failed to fetch news detail', err)
        } finally {
          setContentLoading(false)
        }
      }
    },
    []
  )

  const handlePurchase = useCallback(
    async (item: NewsItem) => {
      if (!user || user.role !== 'PARTICIPANT') return
      setPurchaseLoading(item.id)
      setError(null)
      try {
        const result = await apiClient.post<{ news: any }>(`/news/${item.id}/purchase`)
        const updatedItem = {
          ...item,
          isPurchased: true,
          content: result.news?.content ?? item.content,
        }
        setSelectedNews(updatedItem)
        setNewsItems((prev) =>
          prev.map((n) => (n.id === item.id ? updatedItem : n))
        )
      } catch (err) {
        const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal membeli berita'
        setError(message)
      } finally {
        setPurchaseLoading(null)
      }
    },
    [user]
  )

  const filteredNews = useMemo(() => newsItems, [newsItems])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pusat Berita</h1>
        <p className="text-gray-600">Baca berita dan analisis pasar terbaru</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'free', 'paid'] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
            className={filter === value ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {value === 'all' ? 'Semua' : value === 'free' ? 'Gratis' : 'Berbayar'}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => fetchNews(filter)} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Segarkan
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {/* Paid News Purchase Card */}
      {paidNewsStatus && paidNewsStatus.remainingPurchases > 0 && paidNewsStatus.availableNews > 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Shuffle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900">Berita Berbayar</h3>
                  <p className="text-sm text-amber-700">
                    Sisa pembelian hari ini: <span className="font-bold">{paidNewsStatus.remainingPurchases}</span> dari {paidNewsStatus.maxPaidNewsPerDay}
                  </p>
                  <p className="text-xs text-amber-600">
                    Tersedia {paidNewsStatus.availableNews} berita • Harga: Rp {paidNewsStatus.paidNewsPrice.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleRandomPurchase}
                disabled={randomPurchaseLoading}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {randomPurchaseLoading ? 'Membeli...' : 'Beli Berita Acak'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !filteredNews.length && (
          <Card className="col-span-full">
            <CardContent className="py-6 text-sm text-gray-500">Memuat berita terbaru...</CardContent>
          </Card>
        )}

        {!loading && filteredNews.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-6 text-sm text-gray-500">Belum ada berita untuk filter ini.</CardContent>
          </Card>
        )}

        {filteredNews.map((item) => (
          <Card
            key={item.id}
            className={`hover:shadow-lg transition-all cursor-pointer group overflow-hidden ${item.isHidden ? 'opacity-75' : ''}`}
            onClick={() => item.isHidden ? handleRandomPurchase() : handleOpenNews(item)}
          >
            {/* News Card Header with gradient */}
            <div className={`h-24 relative ${item.isHidden ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                {item.isHidden ? <Lock className="w-16 h-16 text-white" /> : <Newspaper className="w-16 h-16 text-white" />}
              </div>
              {/* Badges */}
              <div className="absolute top-2 left-2 flex gap-1">
                {item.companyCode && !item.isHidden && (
                  <Badge className="bg-white/90 text-emerald-700 text-xs font-semibold">
                    {item.companyCode}
                  </Badge>
                )}
              </div>
              <div className="absolute top-2 right-2">
                {item.isPurchased && (
                  <Badge className="bg-green-500 text-white text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Dibeli
                  </Badge>
                )}
                {item.isPaid && !item.isPurchased && (
                  <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Rp {(item.price ?? 0).toLocaleString('id-ID')}
                  </Badge>
                )}
                {!item.isPaid && (
                  <Badge className="bg-emerald-700 text-white text-xs">Gratis</Badge>
                )}
              </div>
              {/* Day badge */}
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="bg-black/50 text-white text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Hari {item.dayNumber}
                </Badge>
              </div>
            </div>

            <CardContent className="p-4">
              <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.preview}</p>
              {item.isHidden ? (
                <div className="text-xs text-amber-600 font-medium">
                  Klik untuk membeli berita acak
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  {formatShortDate(item.publishedAt)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* News Reader Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
          {selectedNews && (
            <>
              {/* Article Header */}
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-t-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedNews.companyCode && (
                        <Badge className="bg-white/20 text-white border-white/30">
                          <Building2 className="w-3 h-3 mr-1" />
                          {selectedNews.companyCode}
                        </Badge>
                      )}
                      <Badge className="bg-white/20 text-white border-white/30">
                        <Calendar className="w-3 h-3 mr-1" />
                        Hari {selectedNews.dayNumber}
                      </Badge>
                      {selectedNews.isPurchased && (
                        <Badge className="bg-green-500/80 text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Sudah Dibeli
                        </Badge>
                      )}
                      {selectedNews.isPaid && !selectedNews.isPurchased && (
                        <Badge className="bg-amber-500/80 text-white">
                          <Lock className="w-3 h-3 mr-1" />
                          Berbayar
                        </Badge>
                      )}
                      {!selectedNews.isPaid && (
                        <Badge className="bg-emerald-500/80 text-white">Gratis</Badge>
                      )}
                    </div>
                    <DialogTitle className="text-xl md:text-2xl font-bold leading-tight">
                      {selectedNews.title}
                    </DialogTitle>
                    <p className="text-emerald-100 text-sm mt-2">
                      {formatDate(selectedNews.publishedAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Article Content */}
              <ScrollArea className="flex-1 px-6 py-4">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : selectedNews.isPaid && !selectedNews.isPurchased ? (
                  /* Paywall */
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <Lock className="w-10 h-10 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Konten Berbayar</h3>
                    <p className="text-gray-500 mb-6 max-w-md">
                      Berita ini memerlukan pembayaran untuk membaca selengkapnya.
                      Beli sekarang untuk mendapatkan akses penuh ke artikel ini.
                    </p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                      <p className="text-2xl font-bold text-emerald-600">
                        Rp {(selectedNews.price ?? 0).toLocaleString('id-ID')}
                      </p>
                    </div>
                    {user?.role === 'PARTICIPANT' && (
                      <Button
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handlePurchase(selectedNews)}
                        disabled={purchaseLoading === selectedNews.id}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        {purchaseLoading === selectedNews.id ? 'Memproses...' : 'Beli Sekarang'}
                      </Button>
                    )}
                  </div>
                ) : (
                  /* Article Body */
                  <article className="prose prose-emerald max-w-none">
                    <div className="text-gray-700 leading-relaxed text-base whitespace-pre-wrap">
                      {(selectedNews.content ?? selectedNews.preview).split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="mb-4 text-justify">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                )}
              </ScrollArea>

              {/* Article Footer */}
              <div className="border-t px-6 py-4 bg-gray-50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {selectedNews.companyCode && (
                      <span>Terkait: <strong>{selectedNews.companyCode}</strong></span>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Tutup
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
