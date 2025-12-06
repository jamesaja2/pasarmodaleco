'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit2, Trash2, Loader2, RefreshCcw, BarChart2, FileText, Save, Upload, Download, ClipboardPaste } from 'lucide-react'
import { CompanyForm, CompanyFormValues } from '@/components/forms/company-form'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

type CompanyItem = {
  id: string
  stockCode: string
  companyName: string
  sector: string
  location: string
  description: string
  logoUrl: string | null
  sellingPrice: string | null
  sharesOutstanding: number | null
}

type PriceEntry = {
  id: string
  dayNumber: number
  price: number
  isActive: boolean
  createdAt: string
}

type ReportEntry = {
  id: string
  dayNumber: number
  summary: string
  pdfUrl: string | null
  isAvailable: boolean
  updatedAt: string
}

export default function CompaniesPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [managerCompany, setManagerCompany] = useState<CompanyItem | null>(null)
  const [priceEntries, setPriceEntries] = useState<PriceEntry[]>([])
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([])
  const [priceForm, setPriceForm] = useState({ dayNumber: '', price: '', isActive: true })
  const [reportForm, setReportForm] = useState({ dayNumber: '', summary: '', pdfUrl: '', isAvailable: true })
  const [priceLoading, setPriceLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [priceSubmitting, setPriceSubmitting] = useState(false)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [priceImportDialogOpen, setPriceImportDialogOpen] = useState(false)
  const [priceImportData, setPriceImportData] = useState('')
  const [priceImporting, setPriceImporting] = useState(false)
  const [reportDeleting, setReportDeleting] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ companies: any[] }>('/admin/companies')
      const normalized: CompanyItem[] = (response.companies ?? []).map((item) => ({
        id: String(item.id),
        stockCode: String(item.stockCode ?? ''),
        companyName: String(item.companyName ?? ''),
        sector: String(item.sector ?? ''),
        location: String(item.location ?? ''),
        description: String(item.description ?? ''),
        logoUrl: item.logoUrl ?? null,
        sellingPrice: item.sellingPrice ?? null,
        sharesOutstanding: item.sharesOutstanding != null ? Number(item.sharesOutstanding) : null,
      }))
      setCompanies(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat perusahaan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPriceEntries = useCallback(async (company: CompanyItem) => {
    setPriceLoading(true)
    setPriceError(null)
    try {
      const response = await apiClient.get<{ prices: any[] }>(`/admin/companies/${company.id}/prices`)
      const mapped: PriceEntry[] = (response.prices ?? []).map((price: any) => ({
        id: String(price.id ?? `${company.id}-${price.dayNumber}`),
        dayNumber: Number(price.dayNumber ?? 0),
        price: Number(price.price ?? 0),
        isActive: Boolean(price.isActive),
        createdAt: String(price.createdAt ?? new Date().toISOString()),
      }))
      setPriceEntries(mapped.sort((a, b) => a.dayNumber - b.dayNumber))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat harga'
      setPriceError(message)
    } finally {
      setPriceLoading(false)
    }
  }, [])

  const fetchReportEntries = useCallback(async (company: CompanyItem) => {
    setReportLoading(true)
    setReportError(null)
    try {
      const response = await apiClient.get<{ reports: any[] }>(`/admin/companies/${company.id}/financial-reports`)
      const mapped: ReportEntry[] = (response.reports ?? []).map((report: any) => ({
        id: String(report.id ?? `${company.id}-${report.dayNumber}`),
        dayNumber: Number(report.dayNumber ?? 0),
        summary: String(report.reportContent ?? ''),
        pdfUrl: report.pdfUrl ? String(report.pdfUrl) : null,
        isAvailable: Boolean(report.isAvailable),
        updatedAt: String(report.updatedAt ?? new Date().toISOString()),
      }))
      setReportEntries(mapped.sort((a, b) => a.dayNumber - b.dayNumber))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat laporan'
      setReportError(message)
    } finally {
      setReportLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies().catch(() => null)
  }, [fetchCompanies])

  const openCreateDialog = () => {
    setSelectedCompany(null)
    setDialogOpen(true)
  }

  const openEditDialog = (company: CompanyItem) => {
    setSelectedCompany(company)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedCompany(null)
  }

  const openPriceManager = (company: CompanyItem) => {
    setManagerCompany(company)
    setPriceForm({ dayNumber: '', price: '', isActive: true })
    setPriceEntries([])
    setPriceDialogOpen(true)
    fetchPriceEntries(company).catch(() => null)
  }

  const closePriceDialog = () => {
    setPriceDialogOpen(false)
    setManagerCompany(null)
    setPriceEntries([])
    setPriceForm({ dayNumber: '', price: '', isActive: true })
    setPriceError(null)
  }

  const openReportManager = (company: CompanyItem) => {
    setManagerCompany(company)
    setReportForm({ dayNumber: '', summary: '', pdfUrl: '', isAvailable: true })
    setReportEntries([])
    setReportDialogOpen(true)
    fetchReportEntries(company).catch(() => null)
  }

  const closeReportDialog = () => {
    setReportDialogOpen(false)
    setManagerCompany(null)
    setReportEntries([])
    setReportForm({ dayNumber: '', summary: '', pdfUrl: '', isAvailable: true })
    setReportError(null)
  }

  const handleSubmit = async (values: CompanyFormValues) => {
    setFormLoading(true)
    setError(null)
    try {
      if (selectedCompany) {
        await apiClient.put(`/admin/companies/${selectedCompany.id}`, {
          companyName: values.companyName,
          sector: values.sector,
          location: values.location,
          description: values.description || undefined,
          logoUrl: values.logoUrl || undefined,
          sellingPrice: values.sellingPrice,
          sharesOutstanding: values.sharesOutstanding,
        })

        if (values.startingPrice) {
          await apiClient.post(`/admin/companies/${selectedCompany.id}/prices`, {
            dayNumber: 0,
            price: values.startingPrice,
            isActive: true,
          })
        }

        toast({ title: 'Perusahaan diperbarui', description: 'Data perusahaan berhasil diperbarui.' })
      } else {
        const response = await apiClient.post<{ company: any }>('/admin/companies', {
          stockCode: values.stockCode,
          companyName: values.companyName,
          sector: values.sector,
          description: values.description || undefined,
          location: values.location || undefined,
          logoUrl: values.logoUrl || undefined,
          sellingPrice: values.sellingPrice,
          sharesOutstanding: values.sharesOutstanding,
        })

        const createdCompany = response.company
        if (values.startingPrice && createdCompany?.id) {
          await apiClient.post(`/admin/companies/${createdCompany.id}/prices`, {
            dayNumber: 0,
            price: values.startingPrice,
            isActive: true,
          })
        }

        toast({ title: 'Perusahaan ditambahkan', description: 'Perusahaan baru berhasil ditambahkan.' })
      }

      closeDialog()
      await fetchCompanies()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan perusahaan'
      setError(message)
      toast({ title: 'Gagal menyimpan perusahaan', description: message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (company: CompanyItem) => {
    if (!confirm(`Yakin ingin menghapus perusahaan ${company.companyName}?`)) {
      return
    }

    setDeletingId(company.id)
    setError(null)
    try {
      await apiClient.delete(`/admin/companies/${company.id}`)
      toast({ title: 'Perusahaan dihapus', description: 'Perusahaan berhasil dihapus.' })
      await fetchCompanies()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menghapus perusahaan'
      setError(message)
      toast({ title: 'Gagal menghapus perusahaan', description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handlePriceSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!managerCompany) return

    const dayNumber = Number(priceForm.dayNumber)
    const priceValue = Number(priceForm.price)

    if (!Number.isInteger(dayNumber) || dayNumber < 0) {
      setPriceError('Hari harus berupa angka bulat dan tidak negatif')
      return
    }
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setPriceError('Harga harus berupa angka positif')
      return
    }

    setPriceSubmitting(true)
    setPriceError(null)
    try {
      await apiClient.post(`/admin/companies/${managerCompany.id}/prices`, {
        dayNumber,
        price: priceValue,
        isActive: priceForm.isActive,
      })

      toast({ title: 'Harga diperbarui', description: `Harga hari ${dayNumber} berhasil disimpan.` })
      await fetchPriceEntries(managerCompany)
      setPriceForm({ dayNumber: '', price: '', isActive: priceForm.isActive })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan harga'
      setPriceError(message)
      toast({ title: 'Gagal menyimpan harga', description: message, variant: 'destructive' })
    } finally {
      setPriceSubmitting(false)
    }
  }

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!managerCompany) return

    const dayNumber = Number(reportForm.dayNumber)

    if (!Number.isInteger(dayNumber) || dayNumber < 0) {
      setReportError('Hari harus berupa angka bulat dan tidak negatif')
      return
    }
    if (!reportForm.summary.trim()) {
      setReportError('Ringkasan laporan wajib diisi')
      return
    }
    if (!reportForm.pdfUrl.trim()) {
      setReportError('URL PDF wajib diisi')
      return
    }

    setReportSubmitting(true)
    setReportError(null)
    try {
      await apiClient.post(`/admin/companies/${managerCompany.id}/financial-reports`, {
        dayNumber,
        reportContent: reportForm.summary,
        pdfUrl: reportForm.pdfUrl,
        isAvailable: reportForm.isAvailable,
      })

      toast({ title: 'Laporan diperbarui', description: `Laporan hari ${dayNumber} berhasil disimpan.` })
      await fetchReportEntries(managerCompany)
      setReportForm({ dayNumber: '', summary: '', pdfUrl: '', isAvailable: reportForm.isAvailable })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan laporan'
      setReportError(message)
      toast({ title: 'Gagal menyimpan laporan', description: message, variant: 'destructive' })
    } finally {
      setReportSubmitting(false)
    }
  }

  const handleReportDelete = async (reportId: string) => {
    if (!managerCompany) return
    if (!confirm('Yakin ingin menghapus laporan ini?')) return

    setReportDeleting(reportId)
    setReportError(null)
    try {
      await apiClient.delete(`/admin/companies/${managerCompany.id}/financial-reports/${reportId}`)
      toast({ title: 'Laporan dihapus', description: 'Laporan berhasil dihapus.' })
      await fetchReportEntries(managerCompany)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menghapus laporan'
      setReportError(message)
      toast({ title: 'Gagal menghapus', description: message, variant: 'destructive' })
    } finally {
      setReportDeleting(null)
    }
  }

  const filteredCompanies = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return companies
    return companies.filter((company) =>
      [company.companyName, company.stockCode, company.sector, company.location]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [companies, searchTerm])

  const handlePriceImport = async () => {
    if (!priceImportData.trim()) {
      toast({ title: 'Data kosong', description: 'Paste data dari Excel atau isi dengan format CSV', variant: 'destructive' })
      return
    }

    setPriceImporting(true)
    try {
      const response = await fetch('/api/admin/prices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: priceImportData, mode: 'paste' }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Gagal import harga')
      }

      toast({
        title: 'Import berhasil',
        description: `${result.imported} baru, ${result.updated} diperbarui.${result.errors?.length ? ` ${result.errors.length} error.` : ''}`,
      })

      if (result.errors?.length) {
        console.warn('Import errors:', result.errors)
      }

      setPriceImportDialogOpen(false)
      setPriceImportData('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal import harga'
      toast({ title: 'Gagal import', description: message, variant: 'destructive' })
    } finally {
      setPriceImporting(false)
    }
  }

  const downloadPriceTemplate = () => {
    const csvContent = `companyCode,dayNumber,price,isActive
ABCD,0,5000,true
ABCD,1,5100,true
EFGH,0,10000,true
EFGH,1,10500,true`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'template_import_harga.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Perusahaan</h1>
          <p className="text-gray-600">Kelola data perusahaan dan harga saham</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPriceTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Template Harga
          </Button>
          <Button variant="outline" onClick={() => setPriceImportDialogOpen(true)}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Import Harga
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Perusahaan
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Input
            placeholder="Cari perusahaan berdasarkan nama, kode, atau sektor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Button variant="ghost" size="sm" onClick={() => fetchCompanies()} disabled={loading}>
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
          <CardTitle>Daftar Perusahaan</CardTitle>
          <CardDescription>{filteredCompanies.length} perusahaan terdaftar</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">Belum ada perusahaan yang cocok dengan filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Kode</th>
                    <th className="text-left py-3 px-4 font-semibold">Nama Perusahaan</th>
                    <th className="text-left py-3 px-4 font-semibold">Sektor</th>
                    <th className="text-left py-3 px-4 font-semibold">Lokasi</th>
                    <th className="text-left py-3 px-4 font-semibold">Deskripsi</th>
                    <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-emerald-600">{company.stockCode}</td>
                      <td className="py-3 px-4">{company.companyName}</td>
                      <td className="py-3 px-4">{company.sector}</td>
                      <td className="py-3 px-4">{company.location || '-'}</td>
                      <td className="py-3 px-4 text-xs text-gray-600 line-clamp-2">{company.description || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPriceManager(company)} title="Kelola harga">
                            <BarChart2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openReportManager(company)} title="Kelola laporan">
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(company)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleDelete(company)}
                            disabled={deletingId === company.id}
                          >
                            {deletingId === company.id ? (
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
          <CompanyForm
            initialData={selectedCompany ? {
              stockCode: selectedCompany.stockCode,
              companyName: selectedCompany.companyName,
              sector: selectedCompany.sector,
              location: selectedCompany.location,
              description: selectedCompany.description,
              logoUrl: selectedCompany.logoUrl ?? '',
              startingPrice: null,
              sellingPrice: selectedCompany.sellingPrice,
              sharesOutstanding: selectedCompany.sharesOutstanding,
            } : undefined}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            isLoading={formLoading}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={(open) => (!open ? closePriceDialog() : setPriceDialogOpen(open))}>
        <DialogContent className="max-w-3xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Kelola Harga Saham</h2>
              <p className="text-sm text-gray-500">Atur harga per hari untuk {managerCompany?.companyName ?? 'perusahaan'}.</p>
            </div>

            <form className="space-y-4" onSubmit={handlePriceSubmit}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="price-day">Hari</Label>
                  <Input
                    id="price-day"
                    type="number"
                    min={0}
                    value={priceForm.dayNumber}
                    onChange={(event) => setPriceForm((prev) => ({ ...prev, dayNumber: event.target.value }))}
                    placeholder="Contoh: 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price-value">Harga (Rp)</Label>
                  <Input
                    id="price-value"
                    type="number"
                    min={1}
                    step="0.01"
                    value={priceForm.price}
                    onChange={(event) => setPriceForm((prev) => ({ ...prev, price: event.target.value }))}
                    placeholder="Contoh: 10500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price-active">Aktifkan Hari Ini</Label>
                  <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                    <Switch
                      id="price-active"
                      checked={priceForm.isActive}
                      onCheckedChange={(checked) => setPriceForm((prev) => ({ ...prev, isActive: checked }))}
                    />
                    <span className="text-sm text-gray-600">Tandai harga sebagai aktif</span>
                  </div>
                </div>
              </div>

              {priceError && <p className="text-sm text-red-600">{priceError}</p>}

              <div className="flex justify-end">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={priceSubmitting || priceLoading}>
                  {priceSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Harga
                </Button>
              </div>
            </form>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Riwayat Harga</h3>
              {priceLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat harga...
                </div>
              ) : priceEntries.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada harga yang tercatat.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Hari</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Harga</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Status</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Dibuat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceEntries.map((entry) => (
                        <tr key={entry.id} className="border-t">
                          <td className="py-2 px-3 font-semibold">Hari {entry.dayNumber}</td>
                          <td className="py-2 px-3">Rp {entry.price.toLocaleString('id-ID')}</td>
                          <td className="py-2 px-3">
                            <Badge variant={entry.isActive ? 'default' : 'secondary'}>
                              {entry.isActive ? 'Aktif' : 'Belum aktif'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-500">
                            {new Date(entry.createdAt).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reportDialogOpen} onOpenChange={(open) => (!open ? closeReportDialog() : setReportDialogOpen(open))}>
        <DialogContent className="max-w-3xl">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Kelola Laporan Laba Rugi</h2>
              <p className="text-sm text-gray-500">Unggah tautan PDF dan ringkasan laporan untuk {managerCompany?.companyName ?? 'perusahaan'}.</p>
            </div>

            <form className="space-y-4" onSubmit={handleReportSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-day">Hari</Label>
                  <Input
                    id="report-day"
                    type="number"
                    min={0}
                    value={reportForm.dayNumber}
                    onChange={(event) => setReportForm((prev) => ({ ...prev, dayNumber: event.target.value }))}
                    placeholder="Contoh: 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-url">URL PDF</Label>
                  <Input
                    id="report-url"
                    type="url"
                    value={reportForm.pdfUrl}
                    onChange={(event) => setReportForm((prev) => ({ ...prev, pdfUrl: event.target.value }))}
                    placeholder="https://..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-summary">Ringkasan</Label>
                <Textarea
                  id="report-summary"
                  rows={4}
                  value={reportForm.summary}
                  onChange={(event) => setReportForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Tuliskan ringkasan singkat isi laporan"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="report-available"
                  checked={reportForm.isAvailable}
                  onCheckedChange={(checked) => setReportForm((prev) => ({ ...prev, isAvailable: checked }))}
                />
                <Label htmlFor="report-available" className="text-sm text-gray-600">Publikasikan laporan untuk peserta</Label>
              </div>

              {reportError && <p className="text-sm text-red-600">{reportError}</p>}

              <div className="flex justify-end">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={reportSubmitting || reportLoading}>
                  {reportSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Simpan Laporan Laba Rugi
                </Button>
              </div>
            </form>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Laporan Laba Rugi Terdaftar</h3>
              {reportLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat laporan...
                </div>
              ) : reportEntries.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada laporan keuangan yang tersimpan.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Hari</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Ringkasan</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Status</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Terakhir diperbarui</th>
                        <th className="py-2 px-3 text-left font-medium text-gray-600">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportEntries.map((entry) => (
                        <tr key={entry.id} className="border-t align-top">
                          <td className="py-2 px-3 font-semibold">Hari {entry.dayNumber}</td>
                          <td className="py-2 px-3 text-sm text-gray-700 max-w-xs">
                            <p className="line-clamp-3">{entry.summary}</p>
                            {entry.pdfUrl ? (
                              <a href={entry.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline">
                                Lihat PDF
                              </a>
                            ) : null}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant={entry.isAvailable ? 'default' : 'secondary'}>
                              {entry.isAvailable ? 'Dipublikasikan' : 'Draft'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-500">
                            {new Date(entry.updatedAt).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReportDelete(entry.id)}
                              disabled={reportDeleting === entry.id}
                            >
                              {reportDeleting === entry.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Import Dialog */}
      <Dialog open={priceImportDialogOpen} onOpenChange={setPriceImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Import Harga Saham</h2>
              <p className="text-sm text-gray-600">
                Copy dari Excel dan paste langsung, atau upload file CSV
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800 mb-1">Format kolom:</p>
              <code className="text-xs text-blue-700">companyCode | dayNumber | price | isActive (opsional)</code>
              <p className="text-xs text-blue-600 mt-1">
                Contoh: ABCD &nbsp; 0 &nbsp; 5000 &nbsp; true
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Data (paste dari Excel atau CSV)</Label>
              <Textarea
                value={priceImportData}
                onChange={(e) => setPriceImportData(e.target.value)}
                placeholder={`companyCode\tdayNumber\tprice\tisActive
ABCD\t0\t5000\ttrue
ABCD\t1\t5100\ttrue
EFGH\t0\t10000\ttrue`}
                className="mt-1 font-mono text-sm h-48"
              />
              <p className="text-xs text-gray-500 mt-1">
                Baris pertama harus header. Paste langsung dari Excel sudah otomatis tab-separated.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={downloadPriceTemplate} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download Template CSV
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPriceImportDialogOpen(false)}>
                  Batal
                </Button>
                <Button 
                  onClick={handlePriceImport} 
                  disabled={priceImporting || !priceImportData.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {priceImporting ? (
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
