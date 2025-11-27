'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type NewsFormValues = {
  title: string
  content: string
  dayNumber: number
  isPaid: boolean
  price: number | null
  companyId: string | null
  publishedAt: string | null
}

interface NewsFormProps {
  initialData?: NewsFormValues
  companies: Array<{ id: string; stockCode: string; companyName: string }>
  onSubmit: (data: NewsFormValues) => void
  onCancel: () => void
  isLoading?: boolean
}

const formatForInput = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  const hours = String(parsed.getHours()).padStart(2, '0')
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const toIsoString = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function NewsForm({ initialData, companies, onSubmit, onCancel, isLoading }: NewsFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title ?? '',
    content: initialData?.content ?? '',
    dayNumber: initialData?.dayNumber ?? 0,
    isPaid: initialData?.isPaid ?? false,
    price: initialData?.price ?? null,
    companyId: initialData?.companyId ?? null,
    publishedAt: formatForInput(initialData?.publishedAt),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim() || formData.title.trim().length < 5) newErrors.title = 'Judul minimal 5 karakter'
    if (!formData.content.trim() || formData.content.trim().length < 20) newErrors.content = 'Konten minimal 20 karakter'
    if (formData.dayNumber < 0) newErrors.dayNumber = 'Hari tidak boleh negatif'
    if (formData.isPaid && (formData.price == null || formData.price <= 0)) {
      newErrors.price = 'Harga wajib diisi untuk berita berbayar'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    const payload: NewsFormValues = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      dayNumber: formData.dayNumber,
      isPaid: formData.isPaid,
      price: formData.isPaid ? (formData.price ?? 0) : null,
      companyId: formData.companyId ?? null,
      publishedAt: toIsoString(formData.publishedAt),
    }

    onSubmit(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Berita' : 'Tambah Berita Baru'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Judul Berita</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Perusahaan X Laporkan Kinerja Kuartal I"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Konten Berita</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Isi konten berita di sini..."
              rows={6}
              className={`w-full px-3 py-2 border rounded-md resize-none ${errors.content ? 'border-red-500' : ''}`}
            />
            {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hari Simulasi</label>
              <Input
                type="number"
                value={Number.isNaN(formData.dayNumber) ? '' : formData.dayNumber}
                onChange={(e) => {
                  const value = Number.parseInt(e.target.value, 10)
                  setFormData((prev) => ({ ...prev, dayNumber: Number.isNaN(value) ? 0 : value }))
                }}
                min="0"
                className={errors.dayNumber ? 'border-red-500' : ''}
              />
              {errors.dayNumber && <p className="text-xs text-red-600 mt-1">{errors.dayNumber}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Publikasi</label>
              <Input
                type="datetime-local"
                value={formData.publishedAt ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, publishedAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipe Berita</label>
              <select
                value={formData.isPaid ? 'paid' : 'free'}
                onChange={(e) => {
                  const isPaid = e.target.value === 'paid'
                  setFormData((prev) => ({ ...prev, isPaid, price: isPaid ? prev.price ?? 0 : null }))
                }}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="free">Gratis</option>
                <option value="paid">Berbayar</option>
              </select>
            </div>

            {formData.isPaid && (
              <div>
                <label className="block text-sm font-medium mb-1">Harga Berita (Rp)</label>
                <Input
                  type="number"
                  value={formData.price ?? ''}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value, 10)
                    setFormData((prev) => ({ ...prev, price: Number.isNaN(value) ? null : value }))
                  }}
                  min="0"
                  className={errors.price ? 'border-red-500' : ''}
                />
                {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Perusahaan Terkait (Opsional)</label>
            <select
              value={formData.companyId ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setFormData((prev) => ({ ...prev, companyId: value ? value : null }))
              }}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Tidak ada</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.stockCode} • {company.companyName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
              {isLoading ? 'Memproses...' : initialData ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
