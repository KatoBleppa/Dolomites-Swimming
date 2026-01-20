import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Filter, X, Calendar as CalendarIcon } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'

interface TrendData {
  fincode: number
  firstname: string
  lastname: string
  cat_name?: string
  group_name?: string
  month_year: string
  month_date: string
  total_sessions: number
  present_count: number
  justified_count: number
  late_count: number
  absent_count: number
  attendance_percentage: number
}

interface Athlete {
  fincode: number
  firstname: string
  lastname: string
}

interface Season {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
}

interface DailySession {
  sess_id: number
  date: string
  type: string
  status_description: string
}
// Calendar View Component
interface CalendarViewProps {
  sessions: DailySession[]
  monthYear: string
}

function CalendarView({ sessions, monthYear }: CalendarViewProps) {
  const [year, month] = monthYear.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay() // 0 = Sunday
  // Convert to Monday-based (0 = Monday, 6 = Sunday)
  const startDayMonday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

  // Create a map of date to session
  const sessionMap = new Map<string, DailySession>()
  sessions.forEach(session => {
    sessionMap.set(session.date, session)
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return 'bg-green-500 text-white'
      case 'justified': return 'bg-blue-500 text-white'
      case 'late': return 'bg-yellow-500 text-white'
      case 'absent': return 'bg-red-500 text-white'
      default: return 'bg-gray-200 text-gray-500'
    }
  }

  // Build calendar grid
  const calendarDays: (number | null)[] = []
  
  // Add empty cells for days before the 1st
  for (let i = 0; i < startDayMonday; i++) {
    calendarDays.push(null)
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span>Justified</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>Late</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>Absent</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square border-t border-r"></div>
            }

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const session = sessionMap.get(dateStr)

            return (
              <div
                key={day}
                className="aspect-square border-t border-r p-2 relative"
              >
                <div className="text-sm font-medium mb-1">{day}</div>
                {session && (
                  <div className={`text-xs rounded px-1 py-0.5 ${getStatusColor(session.status_description)}`}>
                    {session.status_description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Session List */}
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Session Details</h4>
        <div className="space-y-2">
          {sessions.map(session => (
            <div key={session.sess_id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="font-medium">
                  {new Date(session.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="text-sm text-muted-foreground">{session.type}</div>
              </div>
              <div className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(session.status_description)}`}>
                {session.status_description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
export function AttTrend() {
  const { selectedSeason } = useSeason()
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  // Available options for filters
  const [seasons, setSeasons] = useState<Season[]>([])
  const [groups, setGroups] = useState<{ id: number; group_name: string }[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])

  // Filter states
  const [filterSeason, setFilterSeason] = useState<number | null>(null)
  const [filterGroup, setFilterGroup] = useState<number | null>(null)
  const [filterTrainingType, setFilterTrainingType] = useState<string>('all')
  const [filterAthlete, setFilterAthlete] = useState<number | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<TrendData | null>(null)
  const [dailySessions, setDailySessions] = useState<DailySession[]>([])
  const [loadingDaily, setLoadingDaily] = useState(false)

  // Load filter options
  useEffect(() => {
    loadFilterOptions()
  }, [])

  // Set default group when groups are loaded
  useEffect(() => {
    if (groups.length > 0 && filterGroup === null) {
      setFilterGroup(groups[0].id)
    }
  }, [groups])

  // Load data when season changes
  useEffect(() => {
    if (selectedSeason) {
      setFilterSeason(selectedSeason.season_id)
    }
  }, [selectedSeason])

  // Fetch athletes when group changes
  useEffect(() => {
    if (filterSeason && filterGroup) {
      fetchAthletes()
    }
  }, [filterSeason, filterGroup])

  // Fetch data when filters change
  useEffect(() => {
    if (filterSeason && filterGroup) {
      fetchTrendData()
    }
  }, [filterSeason, filterGroup, filterTrainingType, filterAthlete])

  async function loadFilterOptions() {
    try {
      // Load seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('_seasons')
        .select('season_id, season_name, season_start, season_end')
        .order('season_start', { ascending: false })

      if (seasonsError) throw seasonsError
      setSeasons(seasonsData || [])

      // Load groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('_groups')
        .select('id, group_name')
        .order('id')

      if (groupsError) throw groupsError
      setGroups(groupsData || [])

    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }

  async function fetchAthletes() {
    if (!filterSeason || !filterGroup) return

    try {
      const { data, error } = await supabase
        .rpc('get_athletes_details', {
          p_season_id: filterSeason,
          p_group_id: filterGroup
        })

      if (error) throw error
      
      const athletesList: Athlete[] = (data || []).map((a: any) => ({
        fincode: a.fincode,
        firstname: a.firstname,
        lastname: a.lastname
      }))
      
      setAthletes(athletesList)
      // Reset athlete selection when group changes
      setFilterAthlete(null)
    } catch (error) {
      console.error('Error fetching athletes:', error)
    }
  }

  async function fetchTrendData() {
    if (!filterSeason || !filterGroup) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('attendance_trend', {
          p_season_id: filterSeason,
          p_group_id: filterGroup,
          p_type: filterTrainingType === 'all' ? null : filterTrainingType,
          p_fincode: filterAthlete
        })

      if (error) throw error
      setTrendData(data || [])
    } catch (error) {
      console.error('Error fetching trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchDailyDetails(monthData: TrendData) {
    setLoadingDaily(true)
    setSelectedMonth(monthData)
    setShowModal(true)

    try {
      const [year, month] = monthData.month_year.split('-')
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

      // Build query
      let query = supabase
        .from('sessions')
        .select(`
          sess_id,
          date,
          type,
          attendance!inner (
            fincode,
            status_code,
            _status (
              description
            )
          )
        `)
        .eq('attendance.fincode', monthData.fincode)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date')

      // Add training type filter if not 'all'
      if (filterTrainingType !== 'all') {
        query = query.eq('type', filterTrainingType)
      }

      const { data, error } = await query

      if (error) throw error

      const sessions: DailySession[] = (data || []).map((s: any) => ({
        sess_id: s.sess_id,
        date: s.date,
        type: s.type,
        status_description: s.attendance[0]?._status?.description || 'Not Recorded'
      }))

      setDailySessions(sessions)
    } catch (error) {
      console.error('Error fetching daily details:', error)
      setDailySessions([])
    } finally {
      setLoadingDaily(false)
    }
  }

  // Training types
  const availableTrainingTypes = ['Swim', 'Gym']

  // Get unique athletes from trend data for display
  const athletesByMonth = useMemo(() => {
    const grouped = new Map<number, { athlete: string; data: TrendData[] }>()
    
    trendData.forEach(row => {
      if (!grouped.has(row.fincode)) {
        grouped.set(row.fincode, {
          athlete: `${row.firstname} ${row.lastname}`,
          data: []
        })
      }
      grouped.get(row.fincode)!.data.push(row)
    })
    
    return Array.from(grouped.values())
  }, [trendData])

  // Get all unique months for the chart
  const allMonths = useMemo(() => {
    const months = new Set<string>()
    trendData.forEach(row => months.add(row.month_year))
    return Array.from(months).sort()
  }, [trendData])

  const formatMonth = (monthYear: string) => {
    const [year, month] = monthYear.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  // Get status color
  const getAthleteColor = (index: number) => {
    const colors = [
      'rgb(59, 130, 246)', // blue
      'rgb(16, 185, 129)', // green
      'rgb(249, 115, 22)', // orange
      'rgb(168, 85, 247)', // purple
      'rgb(236, 72, 153)', // pink
      'rgb(251, 191, 36)', // yellow
      'rgb(20, 184, 166)', // teal
      'rgb(239, 68, 68)', // red
    ]
    return colors[index % colors.length]
  }

  const getRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600'
    if (rate >= 75) return 'text-blue-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Attendance Trend</h1>
        <p className="text-muted-foreground mt-2">
          View detailed attendance trends over time
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Season Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Season</label>
              <Select 
                value={filterSeason?.toString() || ''} 
                onValueChange={(val: string) => setFilterSeason(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map(season => (
                    <SelectItem key={season.season_id} value={season.season_id.toString()}>
                      {season.season_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Group</label>
              <Select 
                value={filterGroup?.toString() || ''} 
                onValueChange={(val) => setFilterGroup(Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id.toString()}>{group.group_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Training Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Training Type</label>
              <Select value={filterTrainingType} onValueChange={setFilterTrainingType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Training Types</SelectItem>
                  {availableTrainingTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Athlete Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Athlete</label>
              <Select 
                value={filterAthlete?.toString() || 'all'} 
                onValueChange={(val) => setFilterAthlete(val === 'all' ? null : Number(val))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Athletes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Athletes</SelectItem>
                  {athletes.map(athlete => (
                    <SelectItem key={athlete.fincode} value={athlete.fincode.toString()}>
                      {athlete.firstname} {athlete.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Graph and Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Graph */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Attendance Trend
            </CardTitle>
            <CardDescription>
              Attendance percentage by month
              {filterAthlete && ` for ${athletes.find(a => a.fincode === filterAthlete)?.firstname} ${athletes.find(a => a.fincode === filterAthlete)?.lastname}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No attendance data available for the selected filters
              </p>
            ) : (
              <div className="space-y-6">
                {/* Graph */}
                <div className="relative h-96 border rounded-lg p-4">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted-foreground">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>
                  
                  {/* Graph area */}
                  <div className="ml-12 h-full relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0, 25, 50, 75, 100].map(val => (
                        <div key={val} className="border-t border-gray-200" />
                      ))}
                    </div>
                    
                    {/* SVG for lines */}
                    <svg className="absolute inset-0 w-full h-full" style={{ height: 'calc(100% - 2rem)' }}>
                      {athletesByMonth.map((athlete, athleteIndex) => {
                        const points = athlete.data.map((point, i) => {
                          const x = (i / (allMonths.length - 1 || 1)) * 100
                          const y = 100 - point.attendance_percentage
                          return `${x},${y}`
                        }).join(' ')
                        
                        return (
                          <g key={athlete.athlete}>
                            <polyline
                              points={points}
                              fill="none"
                              stroke={getAthleteColor(athleteIndex)}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                            {athlete.data.map((point, i) => {
                              const x = (i / (allMonths.length - 1 || 1)) * 100
                              const y = 100 - point.attendance_percentage
                              return (
                                <circle
                                  key={i}
                                  cx={`${x}%`}
                                  cy={`${y}%`}
                                  r="4"
                                  fill={getAthleteColor(athleteIndex)}
                                />
                              )
                            })}
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                  
                  {/* X-axis labels */}
                  <div className="ml-12 mt-2 flex justify-between text-xs text-muted-foreground">
                    {allMonths.map((month, i) => (
                      <span key={month} className={i % 2 === 0 ? '' : 'hidden md:inline'}>
                        {formatMonth(month)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center">
                  {athletesByMonth.map((athlete, index) => (
                    <div key={athlete.athlete} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getAthleteColor(index) }}
                      />
                      <span className="text-sm">{athlete.athlete}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Statistics</CardTitle>
            <CardDescription>Detailed breakdown by month</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No data available
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Month</th>
                      <th className="text-left p-2">Athlete</th>
                      <th className="text-right p-2">Sess</th>
                      <th className="text-right p-2">P</th>
                      <th className="text-right p-2">J</th>
                      <th className="text-right p-2">L</th>
                      <th className="text-right p-2">A</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendData.map((row, index) => (
                      <tr key={`${row.fincode}-${row.month_year}-${index}`} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">
                          {formatMonth(row.month_year)}
                        </td>
                        <td className="p-2">
                          {row.firstname} {row.lastname}
                        </td>
                        <td className="p-2 text-right">{row.total_sessions}</td>
                        <td className="p-2 text-right text-green-600">{row.present_count}</td>
                        <td className="p-2 text-right text-blue-600">{row.justified_count}</td>
                        <td className="p-2 text-right text-yellow-600">{row.late_count}</td>
                        <td className="p-2 text-right text-red-600">{row.absent_count}</td>
                        <td className={`p-2 text-right font-semibold ${getRateColor(row.attendance_percentage)}`}>
                          {row.attendance_percentage.toFixed(1)}%
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchDailyDetails(row)}
                          >
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar Modal */}
      {showModal && selectedMonth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto m-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedMonth.firstname} {selectedMonth.lastname} - {formatMonth(selectedMonth.month_year)}
                  </CardTitle>
                  <CardDescription>
                    Attendance: {selectedMonth.attendance_percentage.toFixed(1)}% 
                    ({selectedMonth.present_count} of {selectedMonth.total_sessions} sessions)
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDaily ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : dailySessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sessions found for this month</p>
              ) : (
                <CalendarView sessions={dailySessions} monthYear={selectedMonth.month_year} />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
