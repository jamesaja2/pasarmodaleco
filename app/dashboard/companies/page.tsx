'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient, ApiError } from '@/lib/api-client'
import { RefreshCcw, Search } from 'lucide-react'

type CompanySummary = {
  id: string
  stockCode: string
  name: string
  sector: string
  description: string | null
  location: string | null
  logoUrl: string | null
}

export default function ParticipantCompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<{ companies: any[] }>('/companies')
      const mapped = (response.companies ?? []).map((company: any) => ({
        id: String(company.id),
        stockCode: String(company.stockCode ?? company.code ?? ''),
        name: String(company.name ?? company.companyName ?? company.stockCode ?? ''),
        sector: String(company.sector ?? 'Tidak diketahui'),
        description: company.description ? String(company.description) : null,
        location: company.location ? String(company.location) : null,
        logoUrl: company.logoUrl ? String(company.logoUrl) : null,
      }))
      setCompanies(mapped)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat perusahaan'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies().catch(() => null)
  }, [fetchCompanies])

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return companies
    return companies.filter((company) =>
      [company.stockCode, company.name, company.sector, company.location ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [companies, search])

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daftar Perusahaan</h1>
          <p className="text-gray-600">Lihat profil emiten dan laporan laba rugi per hari simulasi.</p>
        </div>
        <Button variant="outline" onClick={() => fetchCompanies()} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" /> Segarkan
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Cari berdasarkan kode, nama perusahaan, atau sektor"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-500">
            Memuat daftar perusahaan...
          </CardContent>
        </Card>
      ) : filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-gray-500">
            Tidak ada perusahaan yang cocok dengan pencarian.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Link key={company.id} href={`/dashboard/companies/${company.stockCode}`}>
              <Card className="h-full hover:border-emerald-300 hover:shadow transition">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-emerald-600 font-semibold">{company.stockCode}</span>
                    </CardTitle>
                    <CardDescription className="text-base text-gray-800 mt-1">
                      {company.name}
                    </CardDescription>
                  </div>
                  {company.logoUrl ? (
                    <div className="relative h-12 w-12">
                      <Image
                        src={company.logoUrl}
                        alt={`Logo ${company.name}`}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                    <Badge variant="secondary">{company.sector}</Badge>
                    {company.location ? <span>• {company.location}</span> : null}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {company.description ?? 'Belum ada deskripsi perusahaan.'}
                  </p>
                  <p className="text-sm text-emerald-600 font-semibold">Lihat detail &raquo;</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
