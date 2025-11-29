import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
]

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipe file tidak didukung. Gunakan: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Create upload directory if not exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generate unique filename
    const ext = path.extname(file.name)
    const hash = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now()
    const safeName = file.name
      .replace(ext, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50)
    const filename = `${timestamp}-${safeName}-${hash}${ext}`

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = path.join(UPLOAD_DIR, filename)
    await writeFile(filePath, buffer)

    // Generate URL
    const url = `/uploads/${filename}`

    return NextResponse.json({
      success: true,
      filename,
      url,
      size: file.size,
      type: file.type,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to upload file', error)
    return NextResponse.json({ error: 'Gagal mengupload file' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { readdir, stat } = await import('fs/promises')
    
    if (!existsSync(UPLOAD_DIR)) {
      return NextResponse.json({ files: [], total: 0 })
    }

    const files = await readdir(UPLOAD_DIR)
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(UPLOAD_DIR, filename)
        const stats = await stat(filePath)
        return {
          filename,
          url: `/uploads/${filename}`,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
        }
      })
    )

    // Sort by newest first
    fileDetails.sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    return NextResponse.json({
      files: fileDetails,
      total: fileDetails.length,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to list files', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar file' }, { status: 500 })
  }
}
