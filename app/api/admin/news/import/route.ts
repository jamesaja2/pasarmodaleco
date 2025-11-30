import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have header and at least one data row' }, { status: 400 })
    }
    
    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredFields = ['title', 'content', 'daynumber']
    
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        return NextResponse.json({ error: `Missing required column: ${field}` }, { status: 400 })
      }
    }
    
    // Get company mapping (stockCode -> id)
    const companies = await prisma.company.findMany({
      select: { id: true, stockCode: true }
    })
    const companyMap = new Map(companies.map(c => [c.stockCode.toUpperCase(), c.id]))
    
    const errors: string[] = []
    const newsToCreate: any[] = []
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Handle CSV with quotes (for content with commas)
      const values = parseCSVLine(line)
      
      if (values.length !== header.length) {
        errors.push(`Row ${i + 1}: Column count mismatch (expected ${header.length}, got ${values.length})`)
        continue
      }
      
      const row: Record<string, string> = {}
      header.forEach((h, idx) => {
        row[h] = values[idx]?.trim() ?? ''
      })
      
      // Validate required fields
      if (!row.title) {
        errors.push(`Row ${i + 1}: Missing title`)
        continue
      }
      if (!row.content) {
        errors.push(`Row ${i + 1}: Missing content`)
        continue
      }
      
      const dayNumber = parseInt(row.daynumber, 10)
      if (isNaN(dayNumber) || dayNumber < 0) {
        errors.push(`Row ${i + 1}: Invalid dayNumber "${row.daynumber}"`)
        continue
      }
      
      // Parse optional fields
      const isPaid = row.ispaid?.toLowerCase() === 'true' || row.ispaid === '1'
      const price = row.price ? parseFloat(row.price) : null
      
      // Map company by stockCode
      let companyId: string | null = null
      if (row.companycode || row.stockcode) {
        const code = (row.companycode || row.stockcode).toUpperCase()
        companyId = companyMap.get(code) ?? null
        if (!companyId && code) {
          errors.push(`Row ${i + 1}: Company not found with code "${code}"`)
        }
      }
      
      newsToCreate.push({
        title: row.title,
        content: row.content,
        dayNumber,
        isPaid,
        price: isPaid && price ? price : null,
        companyId,
        publishedAt: new Date(),
      })
    }
    
    if (newsToCreate.length === 0) {
      return NextResponse.json({ 
        error: 'No valid rows to import', 
        details: errors 
      }, { status: 400 })
    }
    
    // Create all news entries
    const result = await prisma.news.createMany({
      data: newsToCreate,
    })
    
    return NextResponse.json({ 
      success: true, 
      imported: result.count,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to import news', error)
    return NextResponse.json({ error: 'Failed to import news' }, { status: 500 })
  }
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current)
  return result
}
