'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Save, Loader2, AlertCircle, Shield, Globe } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

type SettingsState = {
  sebUserAgent: string
  sebEnabled: boolean
  allowedIps: string[]
  ipRestrictionEnabled: boolean
  startingBalance: number
  totalDays: number
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [newIp, setNewIp] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingSeb, setSavingSeb] = useState(false)
  const [savingIps, setSavingIps] = useState(false)
  const [savingSimulation, setSavingSimulation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<SettingsState>('/admin/settings')
      setSettings({
        sebUserAgent: data.sebUserAgent ?? '',
        sebEnabled: data.sebEnabled ?? false,
        allowedIps: data.allowedIps ?? [],
        ipRestrictionEnabled: data.ipRestrictionEnabled ?? false,
        startingBalance: data.startingBalance ?? 0,
        totalDays: data.totalDays ?? 0,
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat pengaturan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings().catch(() => null)
  }, [fetchSettings])

  const allowedIps = useMemo(() => settings?.allowedIps ?? [], [settings?.allowedIps])

  const handleAddIp = () => {
    if (!settings) return
    const trimmed = newIp.trim()
    if (!trimmed) return
    if (allowedIps.includes(trimmed)) {
      toast({ title: 'IP sudah terdaftar', description: `${trimmed} sudah ada di whitelist`, variant: 'destructive' })
      return
    }
    setSettings({ ...settings, allowedIps: [...allowedIps, trimmed] })
    setNewIp('')
  }

  const handleRemoveIp = (ip: string) => {
    if (!settings) return
    setSettings({ ...settings, allowedIps: allowedIps.filter((item) => item !== ip) })
  }

  const handleSaveSeb = async () => {
    if (!settings) return
    setSavingSeb(true)
    setError(null)
    try {
      await apiClient.post('/admin/settings', {
        sebUserAgent: settings.sebUserAgent.trim(),
        sebEnabled: settings.sebEnabled,
      })
      toast({ title: 'Pengaturan disimpan', description: 'Konfigurasi Safe Exam Browser berhasil diperbarui.' })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan user agent'
      setError(message)
      toast({ title: 'Gagal menyimpan', description: message, variant: 'destructive' })
    } finally {
      setSavingSeb(false)
    }
  }

  const handleSaveIps = async () => {
    if (!settings) return
    setSavingIps(true)
    setError(null)
    try {
      await apiClient.post('/admin/settings', {
        allowedIps,
        ipRestrictionEnabled: settings.ipRestrictionEnabled,
      })
      toast({ title: 'Whitelist diperbarui', description: 'Daftar IP berhasil diperbarui.' })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan daftar IP'
      setError(message)
      toast({ title: 'Gagal menyimpan', description: message, variant: 'destructive' })
    } finally {
      setSavingIps(false)
    }
  }

  const handleSaveSimulation = async () => {
    if (!settings) return
    setSavingSimulation(true)
    setError(null)
    try {
      await apiClient.post('/admin/settings', {
        totalDays: Number(settings.totalDays),
        startingBalance: Number(settings.startingBalance),
      })
      toast({ title: 'Parameter disimpan', description: 'Total hari dan saldo awal berhasil diperbarui.' })
      await fetchSettings()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal menyimpan parameter simulasi'
      setError(message)
      toast({ title: 'Gagal menyimpan', description: message, variant: 'destructive' })
    } finally {
      setSavingSimulation(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan Sistem</h1>
        <p className="text-gray-600">Konfigurasi keamanan dan parameter simulasi langsung ke database</p>
      </div>

      {error && !loading && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading || !settings ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Konfigurasi Safe Exam Browser
                  </CardTitle>
                  <CardDescription>Atur parameter keamanan akses peserta</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${settings.sebEnabled ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {settings.sebEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <Switch
                    checked={settings.sebEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, sebEnabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`space-y-2 ${!settings.sebEnabled ? 'opacity-50' : ''}`}>
                <label className="font-semibold text-sm">User Agent String SEB</label>
                <Input
                  value={settings.sebUserAgent}
                  onChange={(e) => setSettings({ ...settings, sebUserAgent: e.target.value })}
                  placeholder="Contoh: SafeExamBrowser/3.3.2"
                  disabled={!settings.sebEnabled}
                />
                <p className="text-xs text-gray-600">
                  {settings.sebEnabled 
                    ? 'Hanya perangkat dengan user agent ini yang dapat mengakses dashboard peserta.'
                    : 'Aktifkan toggle untuk menggunakan validasi SEB.'}
                </p>
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSeb} disabled={savingSeb}>
                {savingSeb ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    IP Whitelist
                  </CardTitle>
                  <CardDescription>Daftar IP yang diizinkan mengakses sistem</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${settings.ipRestrictionEnabled ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {settings.ipRestrictionEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <Switch
                    checked={settings.ipRestrictionEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, ipRestrictionEnabled: checked })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={!settings.ipRestrictionEnabled ? 'opacity-50' : ''}>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="Masukkan IP address (contoh: 192.168.1.100)"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIp()}
                    disabled={!settings.ipRestrictionEnabled}
                  />
                  <Button 
                    onClick={handleAddIp} 
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!settings.ipRestrictionEnabled}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah
                  </Button>
                </div>

                <div className="space-y-2 mt-4">
                  <p className="font-semibold text-sm">{allowedIps.length} IP Terdaftar</p>
                  <div className="space-y-2">
                    {allowedIps.length === 0 ? (
                      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                        {settings.ipRestrictionEnabled 
                          ? 'Belum ada IP yang di-whitelist. Semua IP akan ditolak saat validasi berjalan.'
                          : 'IP Restriction nonaktif. Semua IP diizinkan.'}
                      </div>
                    ) : (
                      allowedIps.map((ip) => (
                        <div
                          key={ip}
                          className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                        >
                          <span className="font-mono text-sm">{ip}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleRemoveIp(ip)}
                            disabled={!settings.ipRestrictionEnabled}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveIps} disabled={savingIps}>
                {savingIps ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Whitelist
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parameter Simulasi</CardTitle>
              <CardDescription>Konfigurasi umum untuk simulasi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-semibold text-sm">Total Hari Simulasi</label>
                  <Input
                    type="number"
                    min="1"
                    value={settings.totalDays}
                    onChange={(e) => setSettings({ ...settings, totalDays: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-semibold text-sm">Saldo Awal Default</label>
                  <Input
                    type="number"
                    min="0"
                    step="100000"
                    value={settings.startingBalance}
                    onChange={(e) => setSettings({ ...settings, startingBalance: Number(e.target.value) })}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Perubahan total hari akan berpengaruh pada batas maximum hari di halaman kontrol. Saldo awal digunakan
                ketika membuat akun peserta baru atau mereset simulasi.
              </p>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSimulation} disabled={savingSimulation}>
                {savingSimulation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan Parameter
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
