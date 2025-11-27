'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import { BrokerForm } from '@/components/forms/broker-form'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

type BrokerItem = {
  id: string
  code: string
  name: string
  fee: number
  interestRate: number
  description: string
  isActive: boolean
}

export default function BrokersPage() {
  const { toast } = useToast()
  const [brokers, setBrokers] = useState<BrokerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBroker, setSelectedBroker] = useState<BrokerItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchBrokers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<{ brokers: BrokerItem[] }>('/admin/brokers')
      setBrokers(data.brokers)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat data broker'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrokers().catch(() => null)
  }, [fetchBrokers])

  const openCreateDialog = () => {
    setSelectedBroker(null)
    setDialogOpen(true)
  }

  const openEditDialog = (broker: BrokerItem) => {
    setSelectedBroker(broker)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedBroker(null)
  }

  const handleSubmit = async (values: { code: string; name: string; fee: number; interestRate: number; description: string }) => {
    setActionLoading(true)
    setError(null)
    try {
      if (selectedBroker) {
        await apiClient.put(`/admin/brokers/${selectedBroker.id}`, {
          brokerName: values.name,
          feePercentage: values.fee,
          interestRate: values.interestRate,
          description: values.description,
        })
        toast({ title: 'Broker diperbarui', description: `${values.name} berhasil diperbarui.` })
      } else {
        await apiClient.post('/admin/brokers', {
          brokerCode: values.code,
          brokerName: values.name,
          feePercentage: values.fee,
          interestRate: values.interestRate,
          description: values.description,
        })
        toast({ title: 'Broker ditambahkan', description: `${values.name} berhasil ditambahkan.` })
      }

      closeDialog()
      await fetchBrokers()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan broker'
      setError(message)
      toast({ title: 'Gagal menyimpan broker', description: message, variant: 'destructive' })
      return
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (broker: BrokerItem) => {
    if (!confirm(`Yakin ingin menghapus broker ${broker.name}?`)) {
      return
    }

    setDeletingId(broker.id)
    setError(null)
    try {
      await apiClient.delete(`/admin/brokers/${broker.id}`)
      toast({ title: 'Broker dihapus', description: `${broker.name} berhasil dihapus.` })
      await fetchBrokers()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menghapus broker'
      setError(message)
      toast({ title: 'Gagal menghapus broker', description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )
    }

    if (brokers.length === 0) {
      return (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
          Belum ada broker terdaftar. Tambahkan broker pertama Anda.
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {brokers.map((broker) => (
          <Card key={broker.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{broker.name}</CardTitle>
                  <CardDescription>{broker.code}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">Fee Transaksi</p>
                  <p className="text-xl font-bold text-emerald-600">{broker.fee}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">Bunga Harian</p>
                  <p className="text-xl font-bold text-blue-600">{broker.interestRate}%</p>
                </div>
              </div>
              {broker.description && (
                <p className="text-sm text-gray-600">{broker.description}</p>
              )}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openEditDialog(broker)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-600"
                  onClick={() => handleDelete(broker)}
                  disabled={deletingId === broker.id}
                >
                  {deletingId === broker.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-1" />
                  )}
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }, [brokers, deletingId, error, loading])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Broker</h1>
          <p className="text-gray-600">Kelola daftar broker dan fee transaksi</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Tambah Broker
        </Button>
      </div>

      {renderContent}

      <Dialog open={dialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setDialogOpen(open))}>
        <DialogContent className="max-w-lg p-0">
          <BrokerForm
            initialData={selectedBroker ? {
              code: selectedBroker.code,
              name: selectedBroker.name,
              fee: selectedBroker.fee,
              interestRate: selectedBroker.interestRate,
              description: selectedBroker.description,
            } : undefined}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            isLoading={actionLoading}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
