import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { BarChart3, Users, Calendar as CalendarIcon, Percent, Filter, Search, X } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'

interface AttendanceStats {
  fincode: number
  firstname: string
  lastname: string
  cat_name?: string
  group_name?: string
  total_sessions: number
  attended_sessions: number
  present_count: number
  justified_count: number
  late_count: number
  absent_count: number
  attendance_rate: number
}

interface OverallStats {
  total_sessions: number
  total_attendance_records: number
  average_attendance_rate: number
  athletes_count: number
}

interface Season {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
}


export function AttSumm() {
  const { selectedSeason } = useSeason()
  const [athleteStats, setAthleteStats] = useState<AttendanceStats[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Available options for filters
  const [seasons, setSeasons] = useState<Season[]>([])
  const [groups, setGroups] = useState<{ id: number; group_name: string }[]>([])

  // Filter states
  const [filterSeason, setFilterSeason] = useState<number | null>(null)
  const [filterGroup, setFilterGroup] = useState<number | null>(null)
  const [filterTrainingType, setFilterTrainingType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

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

  // Fetch data when filters change
  useEffect(() => {
    if (filterSeason && filterGroup) {
      fetchAttendanceStats()
    }
  }, [filterSeason, filterGroup, filterTrainingType])

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

  async function fetchAttendanceStats() {
    if (!filterSeason || !filterGroup) return

    setLoading(true)
    try {
      // Fetch complete attendance statistics using the attendance_summary function
      const { data: statsData, error: statsError } = await supabase
        .rpc('attendance_summary', {
          p_season_id: filterSeason,
          p_group_id: filterGroup,
          p_type: filterTrainingType === 'all' ? null : filterTrainingType
        })

      if (statsError) throw statsError

      if (!statsData || statsData.length === 0) {
        setAthleteStats([])
        setOverallStats({
          total_sessions: 0,
          total_attendance_records: 0,
          average_attendance_rate: 0,
          athletes_count: 0
        })
        setLoading(false)
        return
      }

      // Transform data to match AttendanceStats interface
      const statsArray: AttendanceStats[] = statsData.map((stat: any) => ({
        fincode: stat.fincode,
        firstname: stat.firstname,
        lastname: stat.lastname,
        cat_name: stat.cat_name,
        group_name: stat.group_name,
        total_sessions: stat.total_sessions,
        attended_sessions: stat.present_count + stat.late_count + stat.justified_count,
        present_count: stat.present_count,
        justified_count: stat.justified_count,
        late_count: stat.late_count,
        absent_count: stat.absent_count,
        attendance_rate: stat.attendance_percentage
      }))

      setAthleteStats(statsArray)

      // Calculate overall stats
      const totalSessions = statsData[0]?.total_sessions || 0
      const totalRecords = statsData.reduce((sum: number, s: any) => 
        sum + s.present_count + s.justified_count + s.late_count + s.absent_count, 0)
      const attendedRecords = statsData.reduce((sum: number, s: any) => 
        sum + s.present_count + s.late_count + s.justified_count, 0)
      const avgRate = totalRecords > 0 ? (attendedRecords / totalRecords) * 100 : 0

      setOverallStats({
        total_sessions: totalSessions,
        total_attendance_records: totalRecords,
        average_attendance_rate: avgRate,
        athletes_count: statsData.length
      })

    } catch (error) {
      console.error('Error fetching attendance stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Client-side search filtering
  const filteredStats = useMemo(() => {
    if (!searchTerm) return athleteStats

    const search = searchTerm.toLowerCase()
    return athleteStats.filter(stat =>
      `${stat.firstname} ${stat.lastname}`.toLowerCase().includes(search)
    )
  }, [athleteStats, searchTerm])

  // Training types are Swim or Gym
  const availableTrainingTypes = ['Swim', 'Gym']

  // Calculate color for attendance rate
  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600'
    if (rate >= 75) return 'text-blue-600'
    if (rate >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-500'
    if (rate >= 75) return 'bg-blue-500'
    if (rate >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
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
        <h1 className="text-4xl font-bold tracking-tight">Attendance Statistics</h1>
        <p className="text-muted-foreground mt-2">
          View attendance metrics and trends
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
          <div className="grid gap-4 md:grid-cols-4">
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

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Athlete</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          {searchTerm && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Showing {filteredStats.length} of {athleteStats.length} athletes
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="h-8"
              >
                <X className="h-4 w-4 mr-1" />
                Clear search
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.total_sessions}</div>
              {filterTrainingType !== 'all' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {filterTrainingType} only
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Athletes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStats.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Records</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.total_attendance_records}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallStats.average_attendance_rate.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Athlete Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Athlete Attendance</CardTitle>
          <CardDescription>
            Individual attendance rates and session counts
            {filterTrainingType !== 'all' && ` for ${filterTrainingType}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {athleteStats.length === 0 
                ? 'No attendance data available for this period'
                : 'No athletes match the current filters'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Athlete</th>
                    <th className="text-left p-2">Cat</th>
                    <th className="text-left p-2">Group</th>
                    <th className="text-right p-2">Sess</th>
                    <th className="text-right p-2">P</th>
                    <th className="text-right p-2">J</th>
                    <th className="text-right p-2">L</th>
                    <th className="text-right p-2">A</th>
                    <th className="text-right p-2">%</th>
                    <th className="text-left p-2 min-w-[200px]">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStats.map((stats, index) => (
                    <tr key={stats.fincode} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-muted-foreground">{index + 1}</td>
                      <td className="p-2 font-medium">
                        {stats.firstname} {stats.lastname}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {stats.cat_name || '-'}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {stats.group_name || '-'}
                      </td>
                      <td className="p-2 text-right">{stats.total_sessions}</td>
                      <td className="p-2 text-right text-green-600">{stats.present_count}</td>
                      <td className="p-2 text-right text-blue-600">{stats.justified_count}</td>
                      <td className="p-2 text-right text-yellow-600">{stats.late_count}</td>
                      <td className="p-2 text-right text-red-600">{stats.absent_count}</td>
                      <td className={`p-2 text-right font-semibold ${getAttendanceColor(stats.attendance_rate)}`}>
                        {stats.attendance_rate.toFixed(1)}%
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(stats.attendance_rate)}`}
                              style={{ width: `${Math.min(stats.attendance_rate, 100)}%` }}
                            />
                          </div>
                        </div>
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
  )
}
