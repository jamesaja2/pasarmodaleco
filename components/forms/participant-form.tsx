'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ParticipantFormValues = {
  username: string
  teamName: string
  schoolOrigin: string
  brokerId?: string | null
  startingBalance: number
  password?: string
}

interface ParticipantFormProps {
  initialData?: {
    username: string
    teamName: string
    schoolOrigin: string
    brokerId?: string | null
    startingBalance: number
  }
  brokers: Array<{ id: string; code: string; name: string }>
  onSubmit: (data: ParticipantFormValues) => void
  onCancel: () => void
  isLoading?: boolean
}

type FormState = {
  username: string
  teamName: string
  schoolOrigin: string
  brokerId: string
  startingBalance: string
  password: string
}

export function ParticipantForm({ initialData, brokers, onSubmit, onCancel, isLoading }: ParticipantFormProps) {
  const [formData, setFormData] = useState<FormState>(() => ({
    username: initialData?.username ?? '',
    teamName: initialData?.teamName ?? '',
    schoolOrigin: initialData?.schoolOrigin ?? '',
    brokerId: initialData?.brokerId ?? '',
    startingBalance:
      initialData?.startingBalance != null && Number.isFinite(initialData.startingBalance)
        ? String(initialData.startingBalance)
        : '',
    password: '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.username.trim() || formData.username.trim().length < 3) {
      newErrors.username = 'Username minimal 3 karakter'
    }
    if (!formData.teamName.trim()) {
      newErrors.teamName = 'Nama tim harus diisi'
    }
    if (!formData.schoolOrigin.trim()) {
      newErrors.schoolOrigin = 'Asal sekolah harus diisi'
    }
    if (!formData.startingBalance) {
      newErrors.startingBalance = 'Saldo awal harus diisi'
    } else {
      const balanceValue = Number(formData.startingBalance)
      if (!Number.isFinite(balanceValue) || balanceValue < 1_000_000) {
        newErrors.startingBalance = 'Saldo minimal Rp 1.000.000'
      }
    }

    if (!initialData && (!formData.password || formData.password.length < 6)) {
      newErrors.password = 'Password minimal 6 karakter'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    const payload: ParticipantFormValues = {
      username: formData.username.trim(),
      teamName: formData.teamName.trim(),
      schoolOrigin: formData.schoolOrigin.trim(),
      brokerId: formData.brokerId ? formData.brokerId : null,
      startingBalance: Number(formData.startingBalance),
    }

    if (!initialData && formData.password) {
      payload.password = formData.password
    }

    onSubmit(payload)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Peserta' : 'Tambah Peserta Baru'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="timalpha"
                disabled={!!initialData}
                className={errors.username ? 'border-red-500' : ''}
              />
              {errors.username && <p className="text-xs text-red-600 mt-1">{errors.username}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Broker</label>
              <select
                value={formData.brokerId}
                onChange={(e) => setFormData((prev) => ({ ...prev, brokerId: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Biarkan peserta memilih saat login pertama</option>
                {brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.code} • {broker.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Jika dikosongkan, peserta harus memilih broker sendiri saat login pertama.
              </p>
            </div>
          </div>

          {!initialData && (
            <div>
              <label className="block text-sm font-medium mb-1">Password Awal</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Minimal 6 karakter"
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nama Tim</label>
            <Input
              value={formData.teamName}
              onChange={(e) => setFormData((prev) => ({ ...prev, teamName: e.target.value }))}
              placeholder="Tim Alpha"
              className={errors.teamName ? 'border-red-500' : ''}
            />
            {errors.teamName && <p className="text-xs text-red-600 mt-1">{errors.teamName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Asal Sekolah</label>
            <Input
              value={formData.schoolOrigin}
              onChange={(e) => setFormData((prev) => ({ ...prev, schoolOrigin: e.target.value }))}
              placeholder="SMA 1 Jakarta"
              className={errors.schoolOrigin ? 'border-red-500' : ''}
            />
            {errors.schoolOrigin && <p className="text-xs text-red-600 mt-1">{errors.schoolOrigin}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Saldo Awal (Rp)</label>
            <Input
              type="number"
              value={formData.startingBalance}
              onChange={(e) => setFormData((prev) => ({ ...prev, startingBalance: e.target.value }))}
              placeholder="10000000"
              className={errors.startingBalance ? 'border-red-500' : ''}
              min="1000000"
            />
            {errors.startingBalance && <p className="text-xs text-red-600 mt-1">{errors.startingBalance}</p>}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isLoading}>
              {isLoading ? 'Memproses...' : initialData ? 'Update' : 'Simpan'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
