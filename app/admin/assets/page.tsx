'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { apiClient, ApiError } from '@/lib/api-client'
import { Upload, Copy, Trash2, Loader2, Image, FileText, Check } from 'lucide-react'

type UploadedFile = {
  filename: string
  url: string
  size: number
  uploadedAt: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

export default function AssetUploadPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.get<{ files: UploadedFile[]; total: number }>('/admin/upload')
      setFiles(data.files)
    } catch (err) {
      toast({
        title: 'Gagal memuat daftar file',
        description: err instanceof ApiError ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Gagal mengupload file')
      }

      const result = await response.json()
      toast({
        title: 'Upload berhasil',
        description: `File ${result.filename} berhasil diupload`,
      })

      fetchFiles()
    } catch (err) {
      toast({
        title: 'Gagal mengupload',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCopyUrl = async (file: UploadedFile) => {
    const fullUrl = `${window.location.origin}${file.url}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedUrl(file.url)
      toast({
        title: 'URL disalin',
        description: fullUrl,
      })
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch {
      toast({
        title: 'Gagal menyalin',
        description: 'Silakan salin URL secara manual',
        variant: 'destructive',
      })
    }
  }

  const isImage = (filename: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Asset</h1>
        <p className="text-muted-foreground">
          Upload gambar atau dokumen untuk mendapatkan URL yang dapat digunakan di aplikasi
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload File Baru
          </CardTitle>
          <CardDescription>
            Format yang didukung: JPG, PNG, GIF, WebP, SVG, PDF. Maksimal 5MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengupload...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>File yang Diupload</CardTitle>
          <CardDescription>
            Klik tombol salin untuk mendapatkan URL file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada file yang diupload
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {files.map((file) => (
                <div
                  key={file.filename}
                  className="border rounded-lg p-4 space-y-3"
                >
                  {isImage(file.filename) ? (
                    <div className="aspect-video bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="object-contain w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-100 rounded-md flex items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopyUrl(file)}
                    >
                      {copiedUrl === file.url ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Disalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Salin URL
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      <Image className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
