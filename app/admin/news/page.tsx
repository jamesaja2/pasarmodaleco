'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Plus, Edit2, Trash2, Loader2, RefreshCcw, Upload, Download, ClipboardPaste } from 'lucide-react'
import { NewsForm, NewsFormValues } from '@/components/forms/news-form'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type NewsListItem = {
  id: string
  title: string
  content: string
  dayNumber: number
  isPaid: boolean
  price: number | null
  companyId: string | null
  companyCode: string | null
  companyName: string | null
  publishedAt: string | null
}

type CompanyOption = {
  id: string
  stockCode: string
  companyName: string
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('id-ID')
}

export default function NewsManagementPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [newsItems, setNewsItems] = useState<NewsListItem[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsListItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importData, setImportData] = useState('')

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ news: any[] }>('/admin/news')
      const normalized: NewsListItem[] = (response.news ?? []).map((item) => ({
        id: String(item.id),
        title: String(item.title ?? ''),
        content: String(item.content ?? ''),
        dayNumber: Number(item.dayNumber ?? 0),
        isPaid: Boolean(item.isPaid),
        price: item.price != null ? Number(item.price) : null,
        companyId: item.company?.id ?? null,
        companyCode: item.company?.stockCode ?? null,
        companyName: item.company?.name ?? null,
        publishedAt: item.publishedAt ?? null,
      }))
      setNewsItems(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat berita'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await apiClient.get<{ companies: any[] }>('/admin/companies')
      const normalized: CompanyOption[] = (response.companies ?? []).map((item) => ({
        id: String(item.id),
        stockCode: String(item.stockCode ?? ''),
        companyName: String(item.companyName ?? ''),
      }))
      setCompanies(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat perusahaan'
      toast({ title: 'Gagal memuat perusahaan', description: message, variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    fetchNews().catch(() => null)
    fetchCompanies().catch(() => null)
  }, [fetchNews, fetchCompanies])

  const openCreateDialog = () => {
    setSelectedNews(null)
    setDialogOpen(true)
  }

  const openEditDialog = (news: NewsListItem) => {
    setSelectedNews(news)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedNews(null)
  }

  const handleSubmit = async (values: NewsFormValues) => {
    setFormLoading(true)
    setError(null)
    try {
      if (selectedNews) {
        await apiClient.put(`/admin/news/${selectedNews.id}`, {
          title: values.title,
          content: values.content,
          dayNumber: values.dayNumber,
          isPaid: values.isPaid,
          price: values.isPaid ? values.price ?? 0 : undefined,
          companyId: values.companyId ?? null,
          publishedAt: values.publishedAt ?? undefined,
        })
        toast({ title: 'Berita diperbarui', description: 'Berita berhasil diperbarui.' })
      } else {
        await apiClient.post('/admin/news', {
          title: values.title,
          content: values.content,
          dayNumber: values.dayNumber,
          isPaid: values.isPaid,
          price: values.isPaid ? values.price ?? 0 : undefined,
          companyId: values.companyId ?? undefined,
          publishedAt: values.publishedAt ?? undefined,
        })
        toast({ title: 'Berita ditambahkan', description: 'Berita baru berhasil ditambahkan.' })
      }

      closeDialog()
      await fetchNews()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan berita'
      setError(message)
      toast({ title: 'Gagal menyimpan berita', description: message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (news: NewsListItem) => {
    if (!confirm(`Yakin ingin menghapus berita "${news.title}"?`)) {
      return
    }

    setDeletingId(news.id)
    setError(null)
    try {
      await apiClient.delete(`/admin/news/${news.id}`)
      toast({ title: 'Berita dihapus', description: 'Berita berhasil dihapus.' })
      await fetchNews()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menghapus berita'
      setError(message)
      toast({ title: 'Gagal menghapus berita', description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const filteredNews = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return newsItems
    return newsItems.filter((item) => item.title.toLowerCase().includes(query))
  }, [newsItems, searchTerm])

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/news/import', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Gagal import berita')
      }

      toast({
        title: 'Import berhasil',
        description: `${result.imported} berita berhasil diimport.${result.errors?.length ? ` ${result.errors.length} error.` : ''}`,
      })

      if (result.errors?.length) {
        console.warn('Import errors:', result.errors)
      }

      await fetchNews()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal import berita'
      setError(message)
      toast({ title: 'Gagal import', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
      // Reset input
      event.target.value = ''
    }
  }

  const downloadTemplate = () => {
    const csvContent = `title,content,dayNumber,isPaid,price,companyCode
"Judul Berita Contoh","Isi konten berita yang panjang bisa menggunakan tanda kutip",1,false,,ABCD
"Berita Berbayar","Konten berita berbayar",2,true,5000,EFGH
"Berita Umum","Berita tanpa perusahaan terkait",1,false,,`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_import_berita.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handlePasteImport = async () => {
    if (!importData.trim()) {
      toast({ title: 'Data kosong', description: 'Paste data dari Excel atau isi dengan format CSV', variant: 'destructive' })
      return
    }

    setImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/news/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: importData, mode: 'paste' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Gagal import berita')
      }

      toast({
        title: 'Import berhasil',
        description: `${result.imported} berita berhasil diimport.${result.errors?.length ? ` ${result.errors.length} error.` : ''}`,
      })

      if (result.errors?.length) {
        console.warn('Import errors:', result.errors)
      }

      setImportDialogOpen(false)
      setImportData('')
      await fetchNews()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal import berita'
      setError(message)
      toast({ title: 'Gagal import', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Berita</h1>
          <p className="text-gray-600">Kelola berita dan konten untuk peserta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Template CSV
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Paste Import
          </Button>
          <label>
            <Button variant="outline" disabled={importing} asChild>
              <span>
                {importing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import CSV
              </span>
            </Button>
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Buat Berita
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Input
            placeholder="Cari berita..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Button variant="ghost" size="sm" onClick={() => fetchNews()} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Segarkan
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Berita</CardTitle>
          <CardDescription>{filteredNews.length} berita</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">Belum ada berita yang cocok dengan filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Judul</th>
                    <th className="text-left py-3 px-4 font-semibold">Perusahaan</th>
                    <th className="text-center py-3 px-4 font-semibold">Hari</th>
                    <th className="text-center py-3 px-4 font-semibold">Tipe</th>
                    <th className="text-center py-3 px-4 font-semibold">Publikasi</th>
                    <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((news) => (
                    <tr key={news.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">
                        <div className="flex flex-col">
                          <span>{news.title}</span>
                          <span className="text-xs text-gray-500 line-clamp-1">{news.content}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {news.companyCode ? `${news.companyCode} • ${news.companyName ?? ''}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">{news.dayNumber}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            news.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {news.isPaid
                            ? `Berbayar${news.price != null ? ` • Rp ${news.price.toLocaleString('id-ID')}` : ''}`
                            : 'Gratis'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-gray-600">{formatPublishedAt(news.publishedAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(news)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleDelete(news)}
                            disabled={deletingId === news.id}
                          >
                            {deletingId === news.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(open))}>
        <DialogContent className="max-w-2xl p-0">
          <NewsForm
            initialData={selectedNews ? {
              title: selectedNews.title,
              content: selectedNews.content,
              dayNumber: selectedNews.dayNumber,
              isPaid: selectedNews.isPaid,
              price: selectedNews.price,
              companyId: selectedNews.companyId,
              publishedAt: selectedNews.publishedAt,
            } : undefined}
            companies={companies}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            isLoading={formLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Paste Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Import Berita</h2>
              <p className="text-sm text-gray-600">
                Copy dari Excel dan paste langsung, atau ketik dalam format CSV
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">Format kolom:</p>
              <code className="text-xs text-blue-700">title | content | dayNumber | isPaid | price | companyCode</code>
              <p className="text-xs text-blue-600 mt-1">
                Contoh: Judul Berita &nbsp; Isi konten... &nbsp; 1 &nbsp; false &nbsp; &nbsp; ABCD
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Data (paste dari Excel)</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={`title\tcontent\tdayNumber\tisPaid\tprice\tcompanyCode
Berita Hari Ini\tIsi berita lengkap di sini\t1\tfalse\t\tABCD
Berita Berbayar\tKonten premium\t2\ttrue\t5000\tEFGH`}
                className="mt-1 font-mono text-sm h-48"
              />
              <p className="text-xs text-gray-500 mt-1">
                Baris pertama harus header. Paste langsung dari Excel sudah otomatis tab-separated.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={downloadTemplate} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download Template CSV
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Batal
                </Button>
                <Button 
                  onClick={handlePasteImport} 
                  disabled={importing || !importData.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Import
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
