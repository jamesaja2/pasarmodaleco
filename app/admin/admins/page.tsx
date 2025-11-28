'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  AlertCircle, 
  Loader2, 
  Plus, 
  Shield, 
  ShieldCheck, 
  Trash2, 
  UserCog,
  Key
} from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

type AdminUser = {
  id: string
  username: string
  teamName: string | null
  schoolOrigin: string | null
  isSuperAdmin: boolean
  isActive: boolean
  createdAt: string
  lastLogin: string | null
}

export default function AdminsPage() {
  const { toast } = useToast()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newAdmin, setNewAdmin] = useState({
    username: '',
    password: '',
    teamName: '',
    schoolOrigin: '',
  })

  // Reset password dialog
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Delete dialog
  const [showDelete, setShowDelete] = useState(false)
  const [deleteAdmin, setDeleteAdmin] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAdmins = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<{ admins: AdminUser[] }>('/admin/admins')
      setAdmins(data.admins ?? [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal memuat data admin'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  const handleCreate = async () => {
    if (!newAdmin.username || !newAdmin.password) {
      toast({ title: 'Error', description: 'Username dan password harus diisi', variant: 'destructive' })
      return
    }

    setCreating(true)
    try {
      await apiClient.post('/admin/admins', newAdmin)
      toast({ title: 'Berhasil', description: 'Admin baru berhasil ditambahkan' })
      setShowCreate(false)
      setNewAdmin({ username: '', password: '', teamName: '', schoolOrigin: '' })
      await fetchAdmins()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal menambahkan admin'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordAdmin || !newPassword) return

    setResetting(true)
    try {
      await apiClient.put(`/admin/admins/${resetPasswordAdmin.id}`, { password: newPassword })
      toast({ title: 'Berhasil', description: 'Password berhasil direset' })
      setShowResetPassword(false)
      setResetPasswordAdmin(null)
      setNewPassword('')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal mereset password'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteAdmin) return

    setDeleting(true)
    try {
      await apiClient.delete(`/admin/admins/${deleteAdmin.id}`)
      toast({ title: 'Berhasil', description: 'Admin berhasil dihapus' })
      setShowDelete(false)
      setDeleteAdmin(null)
      await fetchAdmins()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal menghapus admin'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      await apiClient.put(`/admin/admins/${admin.id}`, { isActive: !admin.isActive })
      toast({ 
        title: 'Berhasil', 
        description: `Admin ${admin.username} ${!admin.isActive ? 'diaktifkan' : 'dinonaktifkan'}` 
      })
      await fetchAdmins()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal mengubah status admin'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="w-8 h-8" />
            Kelola Admin
          </h1>
          <p className="text-gray-600">Tambah dan kelola user admin (Super Admin only)</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Admin
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Admin</CardTitle>
          <CardDescription>
            Admin biasa dapat mengelola peserta, perusahaan, berita, dan kontrol simulasi. 
            Hanya Super Admin yang dapat mengakses pengaturan sistem dan mengelola admin lain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Belum ada admin terdaftar
            </div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className={`p-4 border rounded-lg flex items-center justify-between ${
                    !admin.isActive ? 'bg-gray-50 opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${admin.isSuperAdmin ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                      {admin.isSuperAdmin ? (
                        <ShieldCheck className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Shield className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{admin.username}</p>
                        {admin.isSuperAdmin && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Super Admin
                          </Badge>
                        )}
                        {!admin.isActive && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600">
                            Nonaktif
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {admin.teamName || '-'} • {admin.schoolOrigin || '-'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Dibuat: {new Date(admin.createdAt).toLocaleDateString('id-ID')}
                        {admin.lastLogin && ` • Login terakhir: ${new Date(admin.lastLogin).toLocaleString('id-ID')}`}
                      </p>
                    </div>
                  </div>
                  
                  {!admin.isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResetPasswordAdmin(admin)
                          setShowResetPassword(true)
                        }}
                      >
                        <Key className="w-4 h-4 mr-1" />
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(admin)}
                      >
                        {admin.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setDeleteAdmin(admin)
                          setShowDelete(true)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Admin Baru</DialogTitle>
            <DialogDescription>
              Admin baru akan memiliki akses ke semua fitur kecuali pengaturan sistem dan manajemen admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username *</label>
              <Input
                value={newAdmin.username}
                onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password *</label>
              <Input
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                placeholder="Min. 6 karakter"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Tim</label>
              <Input
                value={newAdmin.teamName}
                onChange={(e) => setNewAdmin({ ...newAdmin, teamName: e.target.value })}
                placeholder="Opsional"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Asal Sekolah/Institusi</label>
              <Input
                value={newAdmin.schoolOrigin}
                onChange={(e) => setNewAdmin({ ...newAdmin, schoolOrigin: e.target.value })}
                placeholder="Opsional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Tambah Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password untuk admin: {resetPasswordAdmin?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Password Baru</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 karakter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPassword(false)}>
              Batal
            </Button>
            <Button onClick={handleResetPassword} disabled={resetting} className="bg-emerald-600 hover:bg-emerald-700">
              {resetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Admin</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus admin &quot;{deleteAdmin?.username}&quot;? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Batal
            </Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive">
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hapus Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
