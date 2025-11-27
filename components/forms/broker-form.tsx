'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type BrokerFormValues = {
  code: string
  name: string
  fee: number
  interestRate: number
  description: string
}

interface BrokerFormProps {
  initialData?: BrokerFormValues
  onSubmit: (data: BrokerFormValues) => Promise<void> | void
  onCancel: () => void
  isLoading?: boolean
}

export function BrokerForm({ initialData, onSubmit, onCancel, isLoading }: BrokerFormProps) {
  const [formData, setFormData] = useState<BrokerFormValues>(initialData || {
    code: '',
    name: '',
    fee: 0.5,
    interestRate: 0,
    description: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({ code: '', name: '', fee: 0.5, interestRate: 0, description: '' })
    }
    setErrors({})
  }, [initialData])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.code || formData.code.length < 1) newErrors.code = 'Kode broker harus diisi'
    if (!formData.name) newErrors.name = 'Nama broker harus diisi'
    if (formData.fee < 0 || formData.fee > 5) newErrors.fee = 'Fee harus antara 0-5%'
    if (formData.interestRate < 0 || formData.interestRate > 10) newErrors.interestRate = 'Bunga harus antara 0-10%'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      await onSubmit({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        fee: Number(formData.fee),
        interestRate: Number(formData.interestRate),
        description: formData.description?.trim() ?? '',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Broker' : 'Tambah Broker Baru'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kode Broker</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="AV"
                disabled={!!initialData}
                maxLength={3}
              />
              {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fee Transaksi (%)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={formData.fee}
                onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) || 0 })}
                placeholder="0.5"
                className={errors.fee ? 'border-red-500' : ''}
              />
              {errors.fee && <p className="text-xs text-red-600 mt-1">{errors.fee}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bunga Harian (%)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={formData.interestRate}
              onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
              placeholder="0.5"
              className={errors.interestRate ? 'border-red-500' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">Bunga majemuk berdasarkan nilai portofolio, ditambahkan ke saldo setiap pergantian hari</p>
            {errors.interestRate && <p className="text-xs text-red-600 mt-1">{errors.interestRate}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nama Broker</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Astra Venture"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Broker dengan fee kompetitif"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Batal
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
              {isLoading ? 'Memproses...' : initialData ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
