'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Trophy, Medal, RefreshCcw } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type LeaderboardEntry = {
  rank: number
  teamName: string
  school: string
  portfolioValue: number
  returnPercentage: number
}

type DayControl = {
  currentDay: number
  totalDays: number
}

function formatCurrency(value: number) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dayControl, setDayControl] = useState<DayControl | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDay, setSelectedDay] = useState<string>('all')

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [leaderboardRes, dayRes] = await Promise.all([
        apiClient.get<{ leaderboard: any[] }>(`/leaderboard?limit=15`),
        apiClient.get<DayControl>(`/api/days/current`).catch(() => null),
      ])

      const normalized: LeaderboardEntry[] = (leaderboardRes.leaderboard ?? []).map((item) => ({
        rank: Number(item.rank ?? 0),
        teamName: String(item.teamName ?? item.username ?? '-'),
        school: String(item.school ?? '-'),
        portfolioValue: Number(item.portfolioValue ?? 0),
        returnPercentage: Number(item.returnPercentage ?? 0),
      }))
      setEntries(normalized)

      if (dayRes) {
        setDayControl(dayRes)
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Gagal memuat leaderboard'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard().catch(() => null)
  }, [fetchLeaderboard])

  const filteredEntries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    let result = entries

    if (query) {
      result = result.filter((entry) =>
        [entry.teamName, entry.school].join(' ').toLowerCase().includes(query)
      )
    }

    return result
  }, [entries, searchTerm])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-lime-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <h1 className="text-4xl font-bold">Leaderboard</h1>
          </div>
          <p className="text-gray-600">Ranking peserta berdasarkan nilai portfolio</p>
          {dayControl && (
            <p className="text-sm text-gray-500 mt-2">Hari ke-{dayControl.currentDay} dari {dayControl.totalDays} hari simulasi</p>
          )}
          <Button variant="ghost" size="sm" className="mt-4" onClick={fetchLeaderboard} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />Segarkan Data
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <Input
              placeholder="Cari tim atau sekolah..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            {dayControl && dayControl.totalDays > 1 && (
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Hari</SelectItem>
                  {Array.from({ length: dayControl.totalDays }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={`day-${day}`}>
                      Hari {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {loading && !entries.length && (
          <Card>
            <CardContent className="py-6 text-sm text-gray-500 text-center">Memuat leaderboard...</CardContent>
          </Card>
        )}

        {!loading && !entries.length && !error && (
          <Card>
            <CardContent className="py-6 text-sm text-gray-500 text-center">Belum ada data leaderboard.</CardContent>
          </Card>
        )}

        {!loading && filteredEntries.length === 0 && entries.length > 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-gray-500 text-center">Tidak ada peserta yang sesuai dengan pencarian.</CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.rank} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0 w-16">
                    <div
                      className={`flex items-center justify-center h-14 rounded-lg font-bold text-xl ${
                        entry.rank === 1
                          ? 'bg-yellow-100 text-yellow-700'
                          : entry.rank === 2
                          ? 'bg-gray-100 text-gray-700'
                          : entry.rank === 3
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {entry.rank === 1 && <Trophy className="w-6 h-6 mr-1" />}
                      {entry.rank === 2 && <Medal className="w-6 h-6 mr-1 text-gray-500" />}
                      {entry.rank === 3 && <Medal className="w-6 h-6 mr-1 text-orange-600" />}
                      {entry.rank}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{entry.teamName}</h3>
                    <p className="text-sm text-gray-600">{entry.school}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-lg text-emerald-600">{formatCurrency(entry.portfolioValue)}</p>
                    <p className={`text-sm font-semibold ${entry.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.returnPercentage >= 0 ? '+' : ''}
                      {entry.returnPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
