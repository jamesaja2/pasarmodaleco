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
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Data must have header and at least one data row' }, { status: 400 })
    }
    
    // Detect delimiter (tab for paste from Excel, comma for CSV)
    const delimiter = mode === 'paste' || lines[0].includes('\t') ? '\t' : ','
    
    // Parse header
    const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const requiredFields = ['companycode', 'daynumber', 'price']
    
    // Also accept stockcode as alias
    const hasCompanyCode = header.includes('companycode') || header.includes('stockcode')
    if (!hasCompanyCode) {
      return NextResponse.json({ error: 'Missing required column: companyCode or stockCode' }, { status: 400 })
    }
    if (!header.includes('daynumber')) {
      return NextResponse.json({ error: 'Missing required column: dayNumber' }, { status: 400 })
    }
    if (!header.includes('price')) {
      return NextResponse.json({ error: 'Missing required column: price' }, { status: 400 })
    }
    
    // Get company mapping (stockCode -> id)
    const companies = await prisma.company.findMany({
      select: { id: true, stockCode: true }
    })
    const companyMap = new Map(companies.map(c => [c.stockCode.toUpperCase(), c.id]))
    
    const errors: string[] = []
    const pricesToUpsert: { companyId: string; dayNumber: number; price: number; isActive: boolean }[] = []
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = delimiter === '\t' 
        ? line.split('\t').map(v => v.trim().replace(/['"]/g, ''))
        : parseCSVLine(line)
      
      if (values.length < header.length) {
        errors.push(`Row ${i + 1}: Column count mismatch`)
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
