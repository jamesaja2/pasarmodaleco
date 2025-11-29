'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, AlertTriangle, Play, ChevronRight, RotateCcw, Pause, Loader2, Clock } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

type SimulationStatus = {
  currentDay: number
  totalDays: number
  isSimulationActive: boolean
  isPaused?: boolean
  remainingMs?: number | null
  simulationStartDate?: string | null
  lastDayChange?: string | null
}

type AutoSchedulerStatus = {
  enabled: boolean
  intervalMinutes: number | null
  nextRunAt: string | null
}

export default function DaysControlPage() {
  const { toast } = useToast()
  const [status, setStatus] = useState<SimulationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'start' | 'next' | 'end' | 'reset' | 'pause' | 'resume' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoStatus, setAutoStatus] = useState<AutoSchedulerStatus | null>(null)
  const [autoLoading, setAutoLoading] = useState(true)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)
  const [autoInterval, setAutoInterval] = useState('6')

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<SimulationStatus>('/admin/days/status')
      setStatus(data)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat status simulasi'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAutoStatus = useCallback(async () => {
    setAutoLoading(true)
    setAutoError(null)
    try {
      const data = await apiClient.get<AutoSchedulerStatus>('/admin/days/auto')
      setAutoStatus(data)
      if (data.intervalMinutes != null) {
        setAutoInterval(String(data.intervalMinutes))
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat status otomatis'
      setAutoError(message)
    } finally {
      setAutoLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus().catch(() => null)
    fetchAutoStatus().catch(() => null)
  }, [fetchStatus, fetchAutoStatus])

  const handleAction = useCallback(async (type: 'start' | 'next' | 'end' | 'reset' | 'pause' | 'resume') => {
    setAction(type)
    setError(null)
    try {
      if (type === 'start') {
        await apiClient.post('/admin/days/start', {})
        toast({ title: 'Simulasi dimulai', description: 'Hari pertama telah dibuka untuk peserta.' })
      } else if (type === 'next') {
        await apiClient.post('/admin/days/next', {})
        toast({ title: 'Hari berikutnya dibuka', description: 'Harga saham telah diperbarui untuk hari baru.' })
      } else if (type === 'end') {
        await apiClient.post('/admin/days/end', {})
        toast({ title: 'Simulasi dihentikan', description: 'Peserta tidak lagi dapat bertransaksi.' })
      } else if (type === 'reset') {
        await apiClient.post('/admin/days/reset', { confirmation: 'RESET' })
        toast({
          title: 'Simulasi direset',
          description: 'Seluruh data transaksi dan kepemilikan telah dikembalikan ke kondisi awal.',
        })
      } else if (type === 'pause') {
        await apiClient.post('/admin/days/pause', {})
        toast({ title: 'Simulasi di-pause', description: 'Countdown hari berhenti sementara.' })
      } else if (type === 'resume') {
        await apiClient.post('/admin/days/resume', {})
        toast({ title: 'Simulasi dilanjutkan', description: 'Countdown hari berjalan kembali.' })
      }

      await fetchStatus()
      await fetchAutoStatus()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Aksi gagal diproses'
      setError(message)
      toast({ title: 'Aksi gagal', description: message, variant: 'destructive' })
    } finally {
      setAction(null)
    }
  }, [fetchStatus, fetchAutoStatus, toast])

  const handleToggleAuto = useCallback(async (enabled: boolean) => {
    const minutes = Number(autoInterval)
    if (enabled && (!Number.isFinite(minutes) || minutes <= 0)) {
      setAutoError('Interval harus lebih dari 0 menit')
      return
    }

    setAutoSaving(true)
    setAutoError(null)
    try {
      const payload: { enabled: boolean; intervalMinutes?: number } = { enabled }
      if (Number.isFinite(minutes) && minutes > 0) {
        payload.intervalMinutes = minutes
      }

      const data = await apiClient.post<AutoSchedulerStatus>('/admin/days/auto', payload)
      setAutoStatus(data)
      if (data.intervalMinutes != null) {
        setAutoInterval(String(data.intervalMinutes))
      }

      toast({
        title: enabled ? 'Otomatisasi aktif' : 'Otomatisasi dimatikan',
        description: enabled
          ? `Hari akan bergeser otomatis setiap ${data.intervalMinutes ?? minutes} menit.`
          : 'Pergantian hari otomatis dihentikan.',
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memperbarui otomatisasi'
      setAutoError(message)
      toast({ title: 'Gagal menyimpan otomatisasi', description: message, variant: 'destructive' })
    } finally {
      setAutoSaving(false)
    }
  }, [autoInterval, toast])

  const handleSaveInterval = useCallback(async () => {
    const minutes = Number(autoInterval)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setAutoError('Interval harus lebih dari 0 menit')
      return
    }

    setAutoSaving(true)
    setAutoError(null)
    try {
      const data = await apiClient.post<AutoSchedulerStatus>('/admin/days/auto', {
        enabled: autoStatus?.enabled ?? false,
        intervalMinutes: minutes,
      })
      setAutoStatus(data)
      setAutoInterval(String(data.intervalMinutes ?? minutes))
      toast({
        title: 'Interval diperbarui',
        description: `Pergantian hari otomatis menggunakan interval ${data.intervalMinutes ?? minutes} menit.`,
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan interval'
      setAutoError(message)
      toast({ title: 'Gagal menyimpan interval', description: message, variant: 'destructive' })
    } finally {
      setAutoSaving(false)
    }
  }, [autoInterval, autoStatus?.enabled, toast])

  const currentDay = status?.currentDay ?? 0
  const totalDays = status?.totalDays ?? 0
  const simulationActive = status?.isSimulationActive ?? false
  const progress = totalDays > 0 ? Math.min(1, currentDay / totalDays) : 0

  const lastChange = useMemo(() => {
    if (!status?.lastDayChange) return null
    const date = new Date(status.lastDayChange)
    return date.toLocaleString('id-ID')
  }, [status?.lastDayChange])

  const startDate = useMemo(() => {
    if (!status?.simulationStartDate) return null
    const date = new Date(status.simulationStartDate)
    return date.toLocaleString('id-ID')
  }, [status?.simulationStartDate])

  const dayLabels = useMemo(() => {
    if (!totalDays) return []
    return Array.from({ length: totalDays }, (_, index) => index + 1)
  }, [totalDays])

  const nextRunLabel = useMemo(() => {
    if (!autoStatus?.nextRunAt) return null
    const date = new Date(autoStatus.nextRunAt)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString('id-ID')
  }, [autoStatus?.nextRunAt])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Kontrol Hari Simulasi</h1>
        <p className="text-gray-600">Kelola progres dan status simulasi trading secara langsung dari basis data</p>
      </div>

      {error && !loading && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading || !status ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <Card className="bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200">
            <CardHeader>
              <CardTitle>Status Simulasi Saat Ini</CardTitle>
              <CardDescription>Pembaruan terakhir: {lastChange ?? 'Belum ada perubahan'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Hari Saat Ini</p>
                  <p className="text-5xl font-bold text-emerald-600">{currentDay}</p>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-4xl text-gray-400">/</div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Hari</p>
                  <p className="text-5xl font-bold text-gray-600">{totalDays}</p>
                </div>
              </div>
              <div className={`flex items-center gap-4 p-4 rounded-lg ${simulationActive ? 'bg-white' : 'bg-yellow-50 border border-yellow-200'}`}>
                {simulationActive ? (
                  <Play className="w-5 h-5 text-green-600" />
                ) : (
                  <Pause className="w-5 h-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-semibold">{simulationActive ? 'Simulasi Aktif' : 'Simulasi Tidak Aktif'}</p>
                  <p className="text-sm text-gray-600">
                    {simulationActive
                      ? 'Peserta dapat melakukan transaksi untuk hari ini.'
                      : 'Aktifkan simulasi untuk membuka hari pertama.'}
                  </p>
                  {startDate && (
                    <p className="text-xs text-gray-500 mt-1">Dimulai pada: {startDate}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress Hari</CardTitle>
              <CardDescription>Visualisasi progres simulasi berdasarkan total hari</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progres: {Math.round(progress * 100)}%</span>
                  <span>
                    Hari {currentDay} dari {totalDays}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-lime-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline Hari</CardTitle>
              <CardDescription>Daftar keseluruhan hari simulasi yang tersedia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="flex gap-1 pb-2">
                  {dayLabels.map((day) => (
                    <div
                      key={day}
                      className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                        day === currentDay
                          ? 'bg-emerald-600 text-white'
                          : day < currentDay
                          ? 'bg-gray-300 text-gray-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Hari {day}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChevronRight className="w-5 h-5 text-green-600" />
                  Lanjut ke Hari Berikutnya
                </CardTitle>
                <CardDescription>
                  {currentDay >= totalDays
                    ? 'Simulasi telah mencapai hari terakhir.'
                    : `Hari berikutnya: ${currentDay + 1}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => handleAction('next')}
                  disabled={!simulationActive || currentDay >= totalDays || action !== null}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {action === 'next' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-2" />
                  )}
                  Lanjut ke Hari {currentDay + 1}
                </Button>
                <p className="text-xs text-gray-500">
                  Tombol ini aktif saat simulasi berjalan dan belum mencapai hari terakhir.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {status?.isPaused ? (
                    <Play className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Pause className="w-5 h-5 text-orange-600" />
                  )}
                  {status?.isPaused ? 'Lanjutkan Countdown' : 'Pause Countdown'}
                </CardTitle>
                <CardDescription>
                  {status?.isPaused 
                    ? `Countdown sedang di-pause. Sisa waktu: ${Math.floor((status?.remainingMs || 0) / 60000)} menit`
                    : 'Hentikan countdown sementara untuk OBS sync'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.isPaused && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <p className="text-sm text-orange-700">
                      Countdown sedang di-pause. OBS timer juga berhenti.
                    </p>
                  </div>
                )}
                <Button
                  onClick={() => handleAction(status?.isPaused ? 'resume' : 'pause')}
                  disabled={!simulationActive || action !== null}
                  className={`w-full ${status?.isPaused ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                  {action === 'pause' || action === 'resume' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : status?.isPaused ? (
                    <Play className="w-4 h-4 mr-2" />
                  ) : (
                    <Pause className="w-4 h-4 mr-2" />
                  )}
                  {status?.isPaused ? 'Resume Countdown' : 'Pause Countdown'}
                </Button>
                <p className="text-xs text-gray-500">
                  Gunakan ini untuk menghentikan countdown sementara tanpa mengakhiri simulasi.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Reset Simulasi
                </CardTitle>
                <CardDescription>Hapus seluruh data transaksi dan kembalikan ke kondisi awal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-red-700">
                      Tindakan ini akan menghapus semua transaksi, kepemilikan saham, serta mengembalikan saldo peserta.
                    </p>
                    <p className="text-xs text-red-600 mt-1">Ketik RESET saat diminta untuk melanjutkan.</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (confirm('Ketik RESET pada prompt berikut untuk menghapus seluruh data simulasi.')) {
                      const confirmation = prompt('Ketik RESET untuk mengkonfirmasi penghapusan')
                      if (confirmation === 'RESET') {
                        handleAction('reset').catch(() => null)
                      } else if (confirmation !== null) {
                        toast({
                          title: 'Reset dibatalkan',
                          description: 'Konfirmasi tidak sesuai. Data simulasi tetap aman.',
                        })
                      }
                    }
                  }}
                  variant="destructive"
                  className="w-full"
                  disabled={action !== null}
                >
                  {action === 'reset' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Reset Simulasi
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kontrol Aktivasi Simulasi</CardTitle>
              <CardDescription>Mulai atau hentikan simulasi sesuai jadwal</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button
                onClick={() => handleAction(simulationActive ? 'end' : 'start')}
                className={simulationActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                disabled={action !== null}
              >
                {action === 'start' || action === 'end' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : simulationActive ? (
                  <Pause className="w-4 h-4 mr-2" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {simulationActive ? 'Akhiri Simulasi' : 'Mulai Simulasi'}
              </Button>
              <p className="text-sm text-gray-600">
                {simulationActive
                  ? 'Mengakhiri simulasi akan menonaktifkan transaksi peserta sampai Anda memulainya kembali.'
                  : 'Mulai simulasi untuk membuka hari pertama dan mengaktifkan transaksi peserta.'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Otomatisasi Pergantian Hari</CardTitle>
              <CardDescription>Atur interval agar hari berpindah otomatis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {autoLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                </div>
              ) : (
                <>
                  {autoError && (
                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      {autoError}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Status Otomatisasi</p>
                      <p className="text-sm text-gray-600">
                        {autoStatus?.enabled
                          ? 'Pergantian hari berjalan otomatis sesuai interval.'
                          : 'Aktifkan untuk memulai jadwal otomatis.'}
                      </p>
                    </div>
                    <Switch
                      checked={autoStatus?.enabled ?? false}
                      onCheckedChange={(checked) => handleToggleAuto(checked)}
                      disabled={autoSaving}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Interval (menit)</label>
                      <Input
                        type="number"
                        min={1}
                        value={autoInterval}
                        onChange={(event) => setAutoInterval(event.target.value)}
                        disabled={autoSaving}
                      />
                      <p className="mt-1 text-xs text-gray-500">Misal: 6 menit untuk satu hari simulasi.</p>
                    </div>
                    <Button
                      variant="outline"
                      className="self-end"
                      onClick={handleSaveInterval}
                      disabled={autoSaving}
                    >
                      {autoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Simpan Interval
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {autoStatus?.enabled
                        ? nextRunLabel
                          ? `Pergantian berikutnya dijadwalkan pada ${nextRunLabel}.`
                          : 'Menunggu eksekusi otomatis berikutnya.'
                        : 'Otomatisasi sedang nonaktif.'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
