'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Plus, Upload, Edit2, Trash2, Key, Loader2, RefreshCcw, FileDown, Copy, Check, LogIn } from 'lucide-react'
import { ParticipantForm, ParticipantFormValues } from '@/components/forms/participant-form'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

type ParticipantItem = {
  id: string
  username: string
  teamName: string
  schoolOrigin: string
  brokerId: string | null
  brokerCode: string | null
  brokerName: string | null
  startingBalance: number
  currentBalance: number
  isActive: boolean
  hasLoggedIn: boolean
  requiresBrokerSelection: boolean
}

type BrokerOption = {
  id: string
  code: string
  name: string
}

export default function ParticipantsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [participants, setParticipants] = useState<ParticipantItem[]>([])
  const [brokers, setBrokers] = useState<BrokerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [resettingLoginId, setResettingLoginId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [passwordDialog, setPasswordDialog] = useState<{ username: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ participants: any[] }>('/admin/participants')
      const normalized: ParticipantItem[] = (response.participants ?? []).map((item) => ({
        id: String(item.id),
        username: String(item.username ?? ''),
        teamName: String(item.teamName ?? ''),
        schoolOrigin: String(item.schoolOrigin ?? ''),
        brokerId: item.broker?.id ?? null,
        brokerCode: item.broker?.code ?? null,
        brokerName: item.broker?.name ?? null,
        startingBalance: Number(item.startingBalance ?? 0),
        currentBalance: Number(item.currentBalance ?? 0),
        isActive: Boolean(item.isActive ?? true),
        hasLoggedIn: Boolean(item.hasLoggedIn ?? false),
        requiresBrokerSelection: Boolean(item.requiresBrokerSelection ?? false),
      }))
      setParticipants(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat peserta'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBrokers = useCallback(async () => {
    try {
      const response = await apiClient.get<{ brokers: any[] }>('/admin/brokers')
      const normalized: BrokerOption[] = (response.brokers ?? []).map((broker) => ({
        id: String(broker.id),
        code: String(broker.code ?? broker.brokerCode ?? ''),
        name: String(broker.name ?? broker.brokerName ?? ''),
      }))
      setBrokers(normalized)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat broker'
      toast({ title: 'Gagal memuat broker', description: message, variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    fetchParticipants().catch(() => null)
    fetchBrokers().catch(() => null)
  }, [fetchParticipants, fetchBrokers])

  const openCreateDialog = () => {
    setSelectedParticipant(null)
    setDialogOpen(true)
  }

  const openEditDialog = (participant: ParticipantItem) => {
    setSelectedParticipant(participant)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setSelectedParticipant(null)
  }

  const handleSubmit = async (values: ParticipantFormValues) => {
    setFormLoading(true)
    setError(null)
    try {
      if (selectedParticipant) {
        await apiClient.put(`/admin/participants/${selectedParticipant.id}`, {
          teamName: values.teamName,
          schoolOrigin: values.schoolOrigin,
          brokerId: values.brokerId ?? null,
          startingBalance: values.startingBalance,
          currentBalance: values.startingBalance,
        })
        toast({ title: 'Peserta diperbarui', description: 'Data peserta berhasil diperbarui.' })
      } else {
        await apiClient.post('/admin/participants', {
          username: values.username,
          password: values.password,
          teamName: values.teamName,
          schoolOrigin: values.schoolOrigin,
          brokerId: values.brokerId ?? null,
          startingBalance: values.startingBalance,
        })
        toast({ title: 'Peserta ditambahkan', description: 'Peserta baru berhasil ditambahkan.' })
      }

      closeDialog()
      await fetchParticipants()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan peserta'
      setError(message)
      toast({ title: 'Gagal menyimpan peserta', description: message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (participant: ParticipantItem) => {
    if (!confirm(`Yakin ingin menghapus peserta ${participant.teamName}?`)) {
      return
    }

    setDeletingId(participant.id)
    setError(null)
    try {
      await apiClient.delete(`/admin/participants/${participant.id}`)
      toast({ title: 'Peserta dihapus', description: 'Peserta berhasil dihapus.' })
      await fetchParticipants()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menghapus peserta'
      setError(message)
      toast({ title: 'Gagal menghapus peserta', description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetPassword = async (participant: ParticipantItem) => {
    if (!confirm(`Reset password untuk ${participant.username}? Password baru akan dibuat.`)) {
      return
    }

    setResettingId(participant.id)
    try {
      const response = await apiClient.post<{ password: string }>(`/admin/participants/${participant.id}/reset-password`, {})
      const generatedPassword = response.password
      setPasswordDialog({ username: participant.username, password: generatedPassword })
      setCopied(false)
      toast({ title: 'Password berhasil direset', description: 'Silakan catat password baru.' })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal reset password'
      toast({ title: 'Gagal reset password', description: message, variant: 'destructive' })
    } finally {
      setResettingId(null)
    }
  }

  const handleCopyPassword = async () => {
    if (passwordDialog?.password) {
      await navigator.clipboard.writeText(passwordDialog.password)
      setCopied(true)
      toast({ title: 'Tersalin!', description: 'Password berhasil disalin ke clipboard.' })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleResetLogin = async (participant: ParticipantItem) => {
    if (!confirm(`Reset status login untuk ${participant.username}? Peserta akan dapat login kembali.`)) {
      return
    }

    setResettingLoginId(participant.id)
    try {
      await apiClient.post(`/admin/participants/${participant.id}/reset-login`, {})
      toast({ title: 'Login berhasil direset', description: `${participant.username} dapat login kembali.` })
      await fetchParticipants()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal reset login'
      toast({ title: 'Gagal reset login', description: message, variant: 'destructive' })
    } finally {
      setResettingLoginId(null)
    }
  }

  const handleExportCards = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/admin/participants/export-cards', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = typeof payload?.error === 'string' ? payload.error : 'Gagal mengekspor kartu peserta'
        throw new Error(message)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().split('T')[0]
      link.href = downloadUrl
      link.download = `kartu-simulasi-${timestamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      toast({ title: 'Kartu diekspor', description: 'File CSV berisi username dan password berhasil dibuat.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengekspor kartu peserta'
      setError(message)
      toast({ title: 'Gagal mengekspor', description: message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setImporting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/participants/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Gagal mengimpor peserta'
        throw new Error(message)
      }

      const summary = payload.summary as
        | {
            processed: number
            created: number
            skipped: number
            errors: Array<{ row: number; message: string }>
          }
        | undefined

      toast({
        title: 'Impor selesai',
        description: summary
          ? `Berhasil menambahkan ${summary.created} dari ${summary.processed} baris.`
          : 'Data peserta berhasil diimpor.',
      })

      if (summary?.errors?.length) {
        const messages = summary.errors
          .slice(0, 3)
          .map((errorItem) => `Baris ${errorItem.row}: ${errorItem.message}`)
          .join(' | ')
        const extras = summary.errors.length > 3 ? ` dan ${summary.errors.length - 3} baris lainnya` : ''
        toast({
          title: 'Beberapa baris dilewati',
          description: `${messages}${extras}`.trim(),
          variant: 'destructive',
        })
      }

      await fetchParticipants()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengimpor peserta'
      setError(message)
      toast({ title: 'Gagal mengimpor', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const filteredParticipants = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return participants
    return participants.filter((participant) =>
      [
        participant.username,
        participant.teamName,
        participant.schoolOrigin,
        participant.brokerCode ?? '',
        participant.brokerName ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [participants, searchTerm])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manajemen Peserta</h1>
          <p className="text-gray-600">Kelola akun dan data peserta kompetisi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCards} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Export Kartu
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportChange}
          />
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleImportClick} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import CSV
          </Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Peserta
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Input
            placeholder="Cari peserta berdasarkan nama atau username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Button variant="ghost" size="sm" onClick={() => fetchParticipants()} disabled={loading}>
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
          <CardTitle>Daftar Peserta</CardTitle>
          <CardDescription>{filteredParticipants.length} peserta terdaftar</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : filteredParticipants.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">Belum ada peserta yang cocok dengan filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Username</th>
                    <th className="text-left py-3 px-4 font-semibold">Nama Tim</th>
                    <th className="text-left py-3 px-4 font-semibold">Asal Sekolah</th>
                    <th className="text-left py-3 px-4 font-semibold">Broker</th>
                    <th className="text-left py-3 px-4 font-semibold">Saldo Saat Ini</th>
                    <th className="text-center py-3 px-4 font-semibold">Status</th>
                    <th className="text-center py-3 px-4 font-semibold">Login</th>
                    <th className="text-center py-3 px-4 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((participant) => (
                    <tr key={participant.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold">{participant.username}</td>
                      <td className="py-3 px-4">{participant.teamName}</td>
                      <td className="py-3 px-4">{participant.schoolOrigin}</td>
                      <td className="py-3 px-4">
                        {participant.brokerCode ? `${participant.brokerCode} • ${participant.brokerName}` : participant.requiresBrokerSelection ? 'Menunggu pilihan peserta' : '-'}
                      </td>
                      <td className="py-3 px-4">Rp {participant.currentBalance.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${participant.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                          {participant.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${participant.hasLoggedIn ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {participant.hasLoggedIn ? 'Sudah Login' : 'Belum Login'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {participant.hasLoggedIn && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600"
                              title="Reset Login"
                              onClick={() => handleResetLogin(participant)}
                              disabled={resettingLoginId === participant.id}
                            >
                              {resettingLoginId === participant.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <LogIn className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            title="Reset Password"
                            onClick={() => handleResetPassword(participant)}
                            disabled={resettingId === participant.id}
                          >
                            {resettingId === participant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Key className="w-4 h-4" />
                            )}
                          </Button>
                          <Button size="sm" variant="outline" title="Edit" onClick={() => openEditDialog(participant)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            title="Hapus"
                            onClick={() => handleDelete(participant)}
                            disabled={deletingId === participant.id}
                          >
                            {deletingId === participant.id ? (
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
        <DialogContent className="max-w-xl p-0">
          <ParticipantForm
            initialData={selectedParticipant ? {
              username: selectedParticipant.username,
              teamName: selectedParticipant.teamName,
              schoolOrigin: selectedParticipant.schoolOrigin,
              brokerId: selectedParticipant.brokerId,
              startingBalance: selectedParticipant.currentBalance,
            } : undefined}
            brokers={brokers}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
            isLoading={formLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Password Baru */}
      <Dialog open={passwordDialog !== null} onOpenChange={(open) => !open && setPasswordDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-700">Password Baru Berhasil Dibuat</DialogTitle>
            <DialogDescription>
              Password untuk <strong>{passwordDialog?.username}</strong> telah direset. Silakan catat password baru di bawah ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-xs text-gray-500 mb-1">Username:</p>
              <p className="font-mono text-lg font-semibold text-gray-800">{passwordDialog?.username}</p>
              <p className="text-xs text-gray-500 mt-3 mb-1">Password Baru:</p>
              <p className="font-mono text-2xl font-bold text-emerald-600 tracking-wide">{passwordDialog?.password}</p>
            </div>
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              ⚠️ <strong>Penting:</strong> Catat password ini sekarang! Password tidak akan ditampilkan lagi setelah dialog ini ditutup.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCopyPassword}>
              {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Tersalin!' : 'Salin Password'}
            </Button>
            <Button onClick={() => setPasswordDialog(null)} className="bg-emerald-600 hover:bg-emerald-700">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
