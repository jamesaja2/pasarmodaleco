import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

const schema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  dayNumber: z.number().int().min(0),
  isPaid: z.boolean(),
  price: z.number().nonnegative().optional(),
  companyId: z.string().optional().nullable(),
  publishedAt: z.string().datetime().optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    const body = await request.json()
    const data = schema.parse(body)

    const updatePayload: Prisma.NewsUpdateInput = {
      title: data.title,
      content: data.content,
      dayNumber: data.dayNumber,
      isPaid: data.isPaid,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
    }

    if (data.companyId !== undefined) {
      if (data.companyId) {
        updatePayload.company = { connect: { id: data.companyId } }
      } else {
        updatePayload.company = { disconnect: true }
      }
    }

    if (!data.isPaid) {
      updatePayload.price = null
    } else if (data.price !== undefined) {
      updatePayload.price = data.price
    }

    const news = await prisma.news.update({
      where: { id },
      data: updatePayload,
    })

    return NextResponse.json({ success: true, news })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to update news', error)
    return NextResponse.json({ error: 'Failed to update news' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await params
    await prisma.news.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to delete news', error)
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 })
  }
}
