import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useSeason } from '@/contexts/SeasonContext'
import { Activity } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface SessionVolume {
  date: string
  volume: number
}

interface WeeklyVolume {
  weekStart: string
  weekLabel: string
  totalVolume: number
}

interface SeasonInfo {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
}

function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeekMonday(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay() // 0=Sun
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  date.setDate(date.getDate() + offset)
  return toLocalDateString(date)
}

function weekLabelFromStart(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startLabel = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`
  const endLabel = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}`
  return `${startLabel}-${endLabel}`
}

function buildSeasonWeeks(start: string, end: string): WeeklyVolume[] {
  const firstWeekStart = startOfWeekMonday(start)
  const [startY, startM, startD] = firstWeekStart.split('-').map(Number)
  const [endY, endM, endD] = end.split('-').map(Number)

  const current = new Date(startY, startM - 1, startD)
  const endDate = new Date(endY, endM - 1, endD)
  const weeks: WeeklyVolume[] = []

  while (current <= endDate) {
    const weekStart = toLocalDateString(current)
    weeks.push({
      weekStart,
      weekLabel: weekLabelFromStart(weekStart),
      totalVolume: 0,
    })
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

function parseDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(dateString: string, days: number): string {
  const date = parseDate(dateString)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

function diffDays(start: string, end: string): number {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay)
}

function buildWeeklyData(start: string, end: string, sessions: SessionVolume[]): WeeklyVolume[] {
  if (end < start) return []

  const baseWeeks = buildSeasonWeeks(start, end)
  const weekMap = new Map<string, WeeklyVolume>(baseWeeks.map(week => [week.weekStart, { ...week }]))

  sessions.forEach(session => {
    const weekStart = startOfWeekMonday(session.date)
    const existing = weekMap.get(weekStart)
    if (existing) {
      existing.totalVolume += session.volume
    }
  })

  return Array.from(weekMap.values())
}

interface CompareWeeklyPoint {
  weekLabel: string
  activeVolume: number
  [key: string]: string | number | null
}

interface PastSeasonMetric {
  season: SeasonInfo
  totalVolume: number
  averageWeeklyVolume: number
  weeks: number
}

const comparisonLineStrokes = [
  'hsl(var(--destructive))',
  'hsl(var(--ring))',
  'hsl(var(--secondary-foreground))',
  'hsl(var(--accent-foreground))',
  'hsl(var(--muted-foreground))',
]

function WeeklyVolumeChart({
  data,
  activeSeasonName,
  selectedPastSeasons,
}: {
  data: CompareWeeklyPoint[]
  activeSeasonName: string
  selectedPastSeasons: SeasonInfo[]
}) {
  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 16, left: 4, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="weekLabel"
            interval="preserveStartEnd"
            tick={{ fontSize: 12 }}
            angle={-35}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} m`, 'Volume']} labelFormatter={(label: string) => `Week ${label}`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="activeVolume"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name={activeSeasonName}
          />
          {selectedPastSeasons.map((season, index) => (
            <Line
              key={season.season_id}
              type="monotone"
              dataKey={`season_${season.season_id}`}
              stroke={comparisonLineStrokes[index % comparisonLineStrokes.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              name={season.season_name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TrainingTrendy() {
  const { selectedSeason, seasons } = useSeason()
  const [loading, setLoading] = useState(true)
  const [selectedPastSeasonIds, setSelectedPastSeasonIds] = useState<number[]>([])
  const [seasonSessions, setSeasonSessions] = useState<Record<number, SessionVolume[]>>({})

  const today = toLocalDateString(new Date())

  const activeEffectiveEnd = useMemo(() => {
    if (!selectedSeason) return null
    return selectedSeason.season_end < today ? selectedSeason.season_end : today
  }, [selectedSeason, today])

  const comparableSpanDays = useMemo(() => {
    if (!selectedSeason || !activeEffectiveEnd) return -1
    if (activeEffectiveEnd < selectedSeason.season_start) return -1
    return diffDays(selectedSeason.season_start, activeEffectiveEnd)
  }, [selectedSeason, activeEffectiveEnd])

  const pastSeasons = useMemo(() => {
    if (!selectedSeason) return []
    return (seasons as SeasonInfo[])
      .filter(season => season.season_end < selectedSeason.season_start)
      .sort((a, b) => (a.season_start < b.season_start ? 1 : -1))
  }, [seasons, selectedSeason])

  const selectedPastSeasons = useMemo(() => {
    return pastSeasons.filter(season => selectedPastSeasonIds.includes(season.season_id))
  }, [pastSeasons, selectedPastSeasonIds])

  useEffect(() => {
    const validIds = new Set(pastSeasons.map(s => s.season_id))
    setSelectedPastSeasonIds(prev => prev.filter(id => validIds.has(id)))
  }, [pastSeasons])

  useEffect(() => {
    fetchAllSeasonVolumes()
  }, [selectedSeason, selectedPastSeasonIds, comparableSpanDays])

  function getComparableEnd(season: SeasonInfo): string | null {
    if (comparableSpanDays < 0) return null
    const spanEnd = addDays(season.season_start, comparableSpanDays)
    return spanEnd < season.season_end ? spanEnd : season.season_end
  }

  function togglePastSeason(seasonId: number) {
    setSelectedPastSeasonIds(prev =>
      prev.includes(seasonId)
        ? prev.filter(id => id !== seasonId)
        : [...prev, seasonId]
    )
  }

  async function fetchSeasonVolumes(season: SeasonInfo, endDate: string): Promise<SessionVolume[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('date, volume')
      .gte('date', season.season_start)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) throw error

    return (data || []).map(item => ({
      date: item.date,
      volume: Number(item.volume) || 0,
    }))
  }

  async function fetchAllSeasonVolumes() {
    if (!selectedSeason) return

    const activeSeason = selectedSeason as SeasonInfo
    const seasonSelection: SeasonInfo[] = [activeSeason, ...selectedPastSeasons]

    if (seasonSelection.length === 0) {
      setSeasonSessions({})
      return
    }

    setLoading(true)
    try {
      const resultEntries = await Promise.all(
        seasonSelection.map(async season => {
          const endDate = getComparableEnd(season)
          if (!endDate || endDate < season.season_start) {
            return [season.season_id, [] as SessionVolume[]] as const
          }

          const data = await fetchSeasonVolumes(season, endDate)
          return [season.season_id, data] as const
        })
      )

      setSeasonSessions(Object.fromEntries(resultEntries))
    } catch (error) {
      console.error('Error fetching training volumes:', error)
      setSeasonSessions({})
    } finally {
      setLoading(false)
    }
  }

  const activeWeeklyData = useMemo(() => {
    if (!selectedSeason) return []
    const effectiveEnd = getComparableEnd(selectedSeason as SeasonInfo)
    if (!effectiveEnd) return []
    if (effectiveEnd < selectedSeason.season_start) {
      return []
    }

    return buildWeeklyData(
      selectedSeason.season_start,
      effectiveEnd,
      seasonSessions[selectedSeason.season_id] || []
    )
  }, [selectedSeason, seasonSessions, comparableSpanDays])

  const pastWeeklyData = useMemo(() => {
    const output: Record<number, WeeklyVolume[]> = {}

    selectedPastSeasons.forEach(season => {
      const endDate = getComparableEnd(season)
      output[season.season_id] = endDate
        ? buildWeeklyData(season.season_start, endDate, seasonSessions[season.season_id] || [])
        : []
    })

    return output
  }, [selectedPastSeasons, seasonSessions, comparableSpanDays])

  const compareChartData = useMemo(() => {
    return activeWeeklyData.map((activeWeek, index) => {
      const row: CompareWeeklyPoint = {
        weekLabel: activeWeek.weekLabel,
        activeVolume: activeWeek.totalVolume,
      }

      selectedPastSeasons.forEach(season => {
        const seasonWeeklyData = pastWeeklyData[season.season_id] || []
        row[`season_${season.season_id}`] =
          index < seasonWeeklyData.length ? seasonWeeklyData[index].totalVolume : null
      })

      return row
    })
  }, [activeWeeklyData, pastWeeklyData, selectedPastSeasons])

  const totalSeasonVolume = useMemo(
    () => activeWeeklyData.reduce((sum, week) => sum + week.totalVolume, 0),
    [activeWeeklyData]
  )

  const averageWeeklyVolume = activeWeeklyData.length > 0 ? Math.round(totalSeasonVolume / activeWeeklyData.length) : 0
  const selectedPastSeasonMetrics = useMemo((): PastSeasonMetric[] => {
    return selectedPastSeasons.map(season => {
      const seasonWeeklyData = pastWeeklyData[season.season_id] || []
      const totalVolume = seasonWeeklyData.reduce((sum, week) => sum + week.totalVolume, 0)
      const averageWeeklyVolume = seasonWeeklyData.length > 0
        ? Math.round(totalVolume / seasonWeeklyData.length)
        : 0

      return {
        season,
        totalVolume,
        averageWeeklyVolume,
        weeks: seasonWeeklyData.length,
      }
    })
  }, [selectedPastSeasons, pastWeeklyData])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Training Trendy</h1>
        <p className="text-muted-foreground mt-2">
          Weekly training volume in the active season
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Compare Past Seasons</CardTitle>
          <CardDescription>
            Check past seasons to show the same chart for the same elapsed span as the active season
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pastSeasons.length === 0 ? (
            <div className="text-sm text-muted-foreground">No past seasons available</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {pastSeasons.map(season => (
                <label key={season.season_id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedPastSeasonIds.includes(season.season_id)}
                    onChange={() => togglePastSeason(season.season_id)}
                  />
                  <span>{season.season_name}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Season Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSeasonVolume.toLocaleString()} m</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average / Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageWeeklyVolume.toLocaleString()} m</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeWeeklyData.length}</div>
          </CardContent>
        </Card>
      </div>

      {selectedPastSeasonMetrics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {selectedPastSeasonMetrics.flatMap(metric => [
              <Card key={`${metric.season.season_id}-volume`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{metric.season.season_name} Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.totalVolume.toLocaleString()} m</div>
                </CardContent>
              </Card>
              ,<Card key={`${metric.season.season_id}-avg`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{metric.season.season_name} Avg / Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.averageWeeklyVolume.toLocaleString()} m</div>
                </CardContent>
              </Card>
              ,<Card key={`${metric.season.season_id}-weeks`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{metric.season.season_name} Weeks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.weeks}</div>
                </CardContent>
              </Card>
            ])}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Weekly Training Volume</CardTitle>
          </div>
          <CardDescription>
            Sum of session volume for each week (Monday to Sunday)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">Loading chart...</div>
          ) : activeWeeklyData.length === 0 ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">No sessions found for active season</div>
          ) : (
            <WeeklyVolumeChart
              data={compareChartData}
              activeSeasonName={selectedSeason?.season_name || 'Active Season'}
              selectedPastSeasons={selectedPastSeasons}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
