import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    await requireAdmin(request)
    const { id, reportId } = await context.params

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    })

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const report = await prisma.financialReport.findUnique({
      where: { id: reportId },
    })

    if (!report || report.companyId !== company.id) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    await prisma.financialReport.delete({
      where: { id: reportId },
    })

    return NextResponse.json({ success: true, message: 'Report deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to delete financial report', error)
    return NextResponse.json({ error: 'Failed to delete financial report' }, { status: 500 })
  }
}
