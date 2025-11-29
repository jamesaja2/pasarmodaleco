'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient, ApiError } from '@/lib/api-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, FileText, X } from 'lucide-react'

const CHART_COLOR = '#2563EB'

type CompanyDetail = {
  id: string
  stockCode: string
  name: string
  sector: string
  description: string | null
  location: string | null
  logoUrl: string | null
  sellingPrice: string | null
  sharesOutstanding: number | null
}

type PricePoint = {
  id: string
  dayNumber: number
  price: number
}

type FinancialReportItem = {
  id: string
  dayNumber: number
  summary: string
  pdfUrl: string | null
  isAvailable: boolean
  updatedAt: string
}

type CompanyNewsItem = {
  id: string
  title: string
  content: string | null
  dayNumber: number
  isPaid: boolean
  price: number | null
  publishedAt: string
  canRead: boolean
}

type CompanyDetailResponse = {
  company: CompanyDetail
  currentDay: number
  prices: PricePoint[]
  reports: FinancialReportItem[]
  news: CompanyNewsItem[]
}

export default function CompanyDetailPage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const companyCode = params?.code?.toUpperCase() ?? ''

  const [data, setData] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false)
  const [selectedPdf, setSelectedPdf] = useState<{ url: string; title: string } | null>(null)

  const handleOpenPdf = (pdfUrl: string, dayNumber: number) => {
    setSelectedPdf({
      url: pdfUrl,
      title: `Laporan Keuangan - Hari ${dayNumber}`,
    })
    setPdfViewerOpen(true)
  }

  const fetchDetail = useCallback(async () => {
    if (!companyCode) return
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<CompanyDetailResponse>(`/companies/${companyCode}`)
      setData(response)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat detail perusahaan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [companyCode])

  useEffect(() => {
    fetchDetail().catch(() => null)
  }, [fetchDetail])

  const priceSeries = useMemo(() => {
    if (!data) return []
    return data.prices
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((point) => ({
        day: point.dayNumber,
        price: point.price,
      }))
  }, [data])

  if (!companyCode) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-500">
            Kode perusahaan tidak ditemukan.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <Button variant="outline" onClick={() => fetchDetail()} disabled={loading}>
          Muat Ulang
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-500">
            Memuat detail perusahaan...
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                {data.company.logoUrl ? (
                  <div className="relative h-16 w-16">
                    <Image
                      src={data.company.logoUrl}
                      alt={`Logo ${data.company.name}`}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </div>
                ) : null}
                <div>
                  <CardTitle className="text-2xl text-gray-900">
                    {data.company.name}
                  </CardTitle>
                  <CardDescription className="text-base text-gray-700">
                    {data.company.stockCode} • {data.company.sector}
                  </CardDescription>
                  {data.company.location ? (
                    <p className="text-sm text-gray-500 mt-1">{data.company.location}</p>
                  ) : null}
                </div>
              </div>
              <Badge variant="secondary" className="text-sm">
                Hari berjalan: {data.currentDay}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-600">Deskripsi</h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {data.company.description ?? 'Belum ada deskripsi untuk perusahaan ini.'}
                </p>
              </div>

              {data.company.sellingPrice && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Nilai Jual</h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {data.company.sellingPrice}
                  </p>
                </div>
              )}

              {data.company.sharesOutstanding && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">Jumlah Saham Beredar</h2>
                  <p className="text-sm text-gray-700">
                    Rp {data.company.sharesOutstanding.toLocaleString('id-ID')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grafik Harga Saham</CardTitle>
              <CardDescription>Pergerakan harga hingga hari {data.currentDay}</CardDescription>
            </CardHeader>
            <CardContent>
              {priceSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={priceSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" label={{ value: 'Hari', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                    <Line type="monotone" dataKey="price" stroke={CHART_COLOR} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">Belum ada data harga yang aktif untuk perusahaan ini.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Laporan Keuangan</CardTitle>
              <CardDescription>Dokumen akan tersedia ketika hari simulasi terkait dimulai.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.reports.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada laporan keuangan yang tersedia.</p>
              ) : (
                data.reports.map((report) => (
                  <div key={report.id} className="rounded-lg border border-gray-200 p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Hari {report.dayNumber}</p>
                      <p className="text-sm text-gray-600 mt-1">{report.summary}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Terakhir diperbarui: {new Date(report.updatedAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={report.isAvailable ? 'outline' : 'secondary'}>
                        {report.isAvailable ? 'Tersedia' : 'Belum tersedia'}
                      </Badge>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!report.isAvailable || !report.pdfUrl}
                        className="gap-2"
                        onClick={() => report.pdfUrl && handleOpenPdf(report.pdfUrl, report.dayNumber)}
                      >
                        <FileText className="h-4 w-4" /> Lihat PDF
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Berita Perusahaan</CardTitle>
              <CardDescription>Berita akan terbuka sesuai status pembayaran dan hari simulasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.news.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada berita untuk perusahaan ini.</p>
              ) : (
                data.news.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-800">Hari {item.dayNumber}</p>
                        <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                        <p className="text-xs text-gray-500">Terbit: {new Date(item.publishedAt).toLocaleString('id-ID')}</p>
                      </div>
                      <Badge variant={item.isPaid ? 'default' : 'outline'}>
                        {item.isPaid ? 'Berita Premium' : 'Gratis'}
                      </Badge>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      {item.canRead ? (
                        <p className="leading-relaxed whitespace-pre-line">{item.content}</p>
                      ) : (
                        <p>
                          Berita ini bersifat premium. Silakan lakukan pembelian melalui halaman{' '}
                          <Link href="/dashboard/news" className="text-emerald-600 underline">
                            Berita
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-500">
            Perusahaan dengan kode {companyCode} tidak ditemukan.
          </CardContent>
        </Card>
      )}

      {/* PDF Viewer Dialog */}
      <Dialog open={pdfViewerOpen} onOpenChange={setPdfViewerOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b bg-emerald-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedPdf?.title ?? 'Laporan Keuangan'}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-gray-100">
            {selectedPdf?.url && (
              <iframe
                src={`${selectedPdf.url}#toolbar=1&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title={selectedPdf.title}
              />
            )}
          </div>
          <div className="px-6 py-3 border-t bg-gray-50 rounded-b-lg flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedPdf?.url && window.open(selectedPdf.url, '_blank')}
            >
              Buka di Tab Baru
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setPdfViewerOpen(false)}
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
