'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type FormState = {
  stockCode: string
  companyName: string
  sector: string
  location: string
  description: string
  logoUrl: string
  startingPrice: string
}

export type CompanyFormValues = {
  stockCode: string
  companyName: string
  sector: string
  location: string
  description: string
  logoUrl: string
  startingPrice: number | null
}

interface CompanyFormProps {
  initialData?: {
    stockCode: string
    companyName: string
    sector: string
    location: string
    description: string
    logoUrl: string
    startingPrice: number | null
  }
  onSubmit: (data: CompanyFormValues) => void
  onCancel: () => void
  isLoading?: boolean
}

const INITIAL_STATE: FormState = {
  stockCode: '',
  companyName: '',
  sector: '',
  location: '',
  description: '',
  logoUrl: '',
  startingPrice: '',
}

export function CompanyForm({ initialData, onSubmit, onCancel, isLoading }: CompanyFormProps) {
  const [formData, setFormData] = useState<FormState>(() => ({
    stockCode: initialData?.stockCode ?? INITIAL_STATE.stockCode,
    companyName: initialData?.companyName ?? INITIAL_STATE.companyName,
    sector: initialData?.sector ?? INITIAL_STATE.sector,
    location: initialData?.location ?? INITIAL_STATE.location,
    description: initialData?.description ?? INITIAL_STATE.description,
    logoUrl: initialData?.logoUrl ?? INITIAL_STATE.logoUrl,
    startingPrice:
      initialData?.startingPrice != null && Number.isFinite(initialData.startingPrice)
        ? String(initialData.startingPrice)
        : INITIAL_STATE.startingPrice,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.stockCode.trim() || formData.stockCode.trim().length < 2) {
      newErrors.stockCode = 'Kode minimal 2 karakter'
    }
    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Nama perusahaan harus diisi'
    }
    if (!formData.sector.trim()) {
      newErrors.sector = 'Sektor harus diisi'
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Lokasi harus diisi'
    }
    if (formData.logoUrl && !/^https?:\/\//i.test(formData.logoUrl)) {
      newErrors.logoUrl = 'URL logo harus dimulai dengan http atau https'
    }
    if (formData.startingPrice) {
      const priceValue = Number(formData.startingPrice)
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        newErrors.startingPrice = 'Harga awal harus lebih dari 0'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    const payload: CompanyFormValues = {
      stockCode: formData.stockCode.trim().toUpperCase(),
      companyName: formData.companyName.trim(),
      sector: formData.sector.trim(),
      location: formData.location.trim(),
      description: formData.description.trim(),
      logoUrl: formData.logoUrl.trim(),
      startingPrice: formData.startingPrice ? Number(formData.startingPrice) : null,
    }

    onSubmit(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kode Perusahaan</label>
              <Input
                value={formData.stockCode}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stockCode: e.target.value.toUpperCase() }))
                }
                placeholder="Contoh: AKNA"
                className={errors.stockCode ? 'border-red-500' : ''}
                maxLength={5}
                disabled={!!initialData}
              />
              {errors.stockCode && <p className="text-xs text-red-600 mt-1">{errors.stockCode}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Harga Hari 0 (Rp)</label>
              <Input
                type="number"
                value={formData.startingPrice}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startingPrice: e.target.value }))
                }
                placeholder="5000"
                className={errors.startingPrice ? 'border-red-500' : ''}
                min="0"
              />
              {errors.startingPrice && <p className="text-xs text-red-600 mt-1">{errors.startingPrice}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nama Perusahaan</label>
            <Input
              value={formData.companyName}
              onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
              placeholder="Arkana Digital Nusantara"
              className={errors.companyName ? 'border-red-500' : ''}
            />
            {errors.companyName && <p className="text-xs text-red-600 mt-1">{errors.companyName}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sektor</label>
              <Input
                value={formData.sector}
                onChange={(e) => setFormData((prev) => ({ ...prev, sector: e.target.value }))}
                placeholder="Teknologi"
                className={errors.sector ? 'border-red-500' : ''}
              />
              {errors.sector && <p className="text-xs text-red-600 mt-1">{errors.sector}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Lokasi</label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Jakarta"
                className={errors.location ? 'border-red-500' : ''}
              />
              {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Profil singkat perusahaan..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">URL Logo (Opsional)</label>
            <Input
              value={formData.logoUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="https://example.com/logo.svg"
              className={errors.logoUrl ? 'border-red-500' : ''}
            />
            {errors.logoUrl && <p className="text-xs text-red-600 mt-1">{errors.logoUrl}</p>}
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
