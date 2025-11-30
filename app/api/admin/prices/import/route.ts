import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const body = await request.json()
    const { data, mode } = body // mode: 'csv' or 'paste'
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }
    
    const lines = data.split('\n').filter(line => line.trim())
    
    if (lines.length < 1) {
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 })
    }
    
    // Detect delimiter (tab, space, or comma)
    const firstLine = lines[0]
    let delimiter = ','
    if (firstLine.includes('\t')) {
      delimiter = '\t'
    } else if (!firstLine.includes(',') && firstLine.includes(' ')) {
      delimiter = ' '
    }
    
    // Check if first line is header or data
    const firstLineParts = firstLine.split(delimiter === ' ' ? /\s+/ : delimiter).map(p => p.trim().toLowerCase().replace(/['"]/g, ''))
    const hasHeader = firstLineParts.includes('companycode') || firstLineParts.includes('stockcode') || 
                      firstLineParts.includes('daynumber') || firstLineParts.includes('price')
    
    let header: string[]
    let startIndex: number
    
    if (hasHeader) {
      header = firstLineParts
      startIndex = 1
      if (lines.length < 2) {
        return NextResponse.json({ error: 'Data must have at least one data row after header' }, { status: 400 })
      }
    } else {
      // No header - assume format: companyCode, dayNumber, price, isActive (optional)
      header = ['companycode', 'daynumber', 'price', 'isactive']
      startIndex = 0
    }
    
    // Get company mapping (stockCode -> id)
    const companies = await prisma.company.findMany({
      select: { id: true, stockCode: true }
    })
    const companyMap = new Map(companies.map(c => [c.stockCode.toUpperCase(), c.id]))
    
    const errors: string[] = []
    const pricesToUpsert: { companyId: string; dayNumber: number; price: number; isActive: boolean }[] = []
    
    // Parse data rows
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = delimiter === ' ' 
        ? line.split(/\s+/).map(v => v.trim().replace(/['"]/g, ''))
        : delimiter === '\t' 
          ? line.split('\t').map(v => v.trim().replace(/['"]/g, ''))
          : parseCSVLine(line)
      
      if (values.length < 3) {
        errors.push(`Row ${i + 1}: Need at least 3 columns (companyCode, dayNumber, price)`)
        continue
      }
      
      const row: Record<string, string> = {}
      header.forEach((h, idx) => {
        row[h] = values[idx]?.trim() ?? ''
      })
      
      // Get company code
      const companyCode = (row.companycode || row.stockcode || '').toUpperCase()
      if (!companyCode) {
        errors.push(`Row ${i + 1}: Missing company code`)
        continue
      }
      
      const companyId = companyMap.get(companyCode)
      if (!companyId) {
        errors.push(`Row ${i + 1}: Company not found: ${companyCode}`)
        continue
      }
      
      const dayNumber = parseInt(row.daynumber, 10)
      if (isNaN(dayNumber) || dayNumber < 0) {
        errors.push(`Row ${i + 1}: Invalid dayNumber: ${row.daynumber}`)
        continue
      }
      
      const price = parseFloat(row.price.replace(/[,]/g, ''))
      if (isNaN(price) || price < 0) {
        errors.push(`Row ${i + 1}: Invalid price: ${row.price}`)
        continue
      }
      
      const isActive = row.isactive?.toLowerCase() === 'true' || row.isactive === '1' || row.isactive === undefined
      
      pricesToUpsert.push({
        companyId,
        dayNumber,
        price,
        isActive: isActive !== false,
      })
    }
    
    if (pricesToUpsert.length === 0) {
      return NextResponse.json({ 
        error: 'No valid rows to import', 
        details: errors 
      }, { status: 400 })
    }
    
    // Upsert prices (update if exists, create if not)
    let imported = 0
    let updated = 0
    
    for (const priceData of pricesToUpsert) {
      const existing = await prisma.stockPrice.findFirst({
        where: {
          companyId: priceData.companyId,
          dayNumber: priceData.dayNumber,
        }
      })
      
      if (existing) {
        await prisma.stockPrice.update({
          where: { id: existing.id },
          data: { price: priceData.price, isActive: priceData.isActive }
        })
        updated++
      } else {
        await prisma.stockPrice.create({
          data: priceData
        })
        imported++
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      imported,
      updated,
      total: imported + updated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to import prices', error)
    return NextResponse.json({ error: 'Failed to import prices' }, { status: 500 })
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
        current += '"'
        i++
      } else {
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
