import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { Users } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface Athlete {
  fincode: number
  firstname: string
  lastname: string
}

interface Group {
  id: number
  group_name: string
}

interface ProgressData {
  fincode: number
  firstname: string
  lastname: string
  race_id: number
  distance: number
  stroke_short_en: string
  meet_date: string
  meet_name: string
  res_time_decimal: number
  time_str: string
  improvement: number
  best_time: number
}

interface GroupStats {
  group_name: string
  total_athletes: number
  avg_improvement: number
  total_races: number
}

export function Progress() {
  const { selectedSeason } = useSeason()
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<number | null>(null)
  const [selectedRace, setSelectedRace] = useState<number | null>(null)
  const [progressData, setProgressData] = useState<ProgressData[]>([])
  const [groupStats, setGroupStats] = useState<GroupStats[]>([])
  const [races, setRaces] = useState<{ race_id: number; race_name: string }[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number>(2)
  const [viewMode, setViewMode] = useState<'individual' | 'group'>('individual')

  useEffect(() => {
    if (selectedSeason) {
      fetchGroups()
      fetchRaces()
      fetchGroupStats()
    }
  }, [selectedSeason])

  useEffect(() => {
    if (selectedSeason && selectedGroup) {
      fetchAthletes()
      setSelectedAthlete(null) // Clear athlete selection when group changes
    }
  }, [selectedSeason, selectedGroup])

  useEffect(() => {
    if (selectedSeason && selectedAthlete && selectedRace) {
      fetchProgressData()
    }
  }, [selectedSeason, selectedAthlete, selectedRace, selectedCourse])

 

  async function fetchGroups() {
    try {
      const { data, error } = await supabase
        .from('_groups')
        .select('id, group_name')
        .order('group_name')

      if (error) throw error

      setGroups(data || [])
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  async function fetchAthletes() {
    if (!selectedSeason || !selectedGroup) return

    try {
      // Get the group_id from the selected group
      const selectedGroupObj = groups.find(g => g.group_name === selectedGroup)
      if (!selectedGroupObj) return

      // Use get_athletes_details function
      const { data, error } = await supabase
        .rpc('get_athletes_details', {
          p_season_id: selectedSeason.season_id,
          p_group_id: selectedGroupObj.id
        })

      if (error) throw error

      const athleteList = data?.map((item: any) => ({
        fincode: item.fincode,
        lastname: item.lastname,
        firstname: item.firstname,
      })) || []

      setAthletes(athleteList)
    } catch (error) {
      console.error('Error fetching athletes:', error)
    }
  }

  async function fetchRaces() {
    try {
      const { data, error } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en')
        .order('race_id')

      if (error) throw error

      const raceList = data?.map(race => ({
        race_id: race.race_id,
        race_name: `${race.distance}m ${race.stroke_short_en}`,
      })) || []

      setRaces(raceList)
    } catch (error) {
      console.error('Error fetching races:', error)
    }
  }

  async function fetchProgressData() {
    if (!selectedSeason || !selectedAthlete || !selectedRace) return

    try {
      setLoading(true)

      // Get the race details to find corresponding event
      const { data: raceData } = await supabase
        .from('_races')
        .select('distance, stroke_short_en')
        .eq('race_id', selectedRace)
        .single()

      if (!raceData) return

      // Fetch progress data using the SQL function
      const { data: results, error } = await supabase
        .rpc('progress_data', {
          athlete_fincode: selectedAthlete,
          ms_race: selectedRace,
        })

      if (error) throw error

      // Filter results by course if needed
      let filteredResults = results || []
      if (filteredResults.length > 0) {
        const meetIds = Array.from(new Set(filteredResults.map((r: any) => r.meet_id)))
        const { data: meetsData, error: meetsError } = await supabase
          .from('meets')
          .select('meet_id, meet_course')
          .in('meet_id', meetIds)

        if (meetsError) throw meetsError

        const meetCourseMap: Map<number, number> = new Map();
        (meetsData || []).forEach((m: any) => meetCourseMap.set(m.meet_id, m.meet_course));

        filteredResults = filteredResults.filter((r: any) => meetCourseMap.get(r.meet_id) === selectedCourse);
      }

      // Get athlete info
      const athlete = athletes.find(a => a.fincode === selectedAthlete)
      if (!athlete) return

      // Process filtered results to calculate improvement
      const processedData: ProgressData[] = []
      let bestTime = Infinity

      filteredResults.forEach((result: any) => {
        const time = result.res_time_decimal

        if (time < bestTime) {
          bestTime = time
        }

        const improvement = processedData.length > 0
          ? processedData[processedData.length - 1].res_time_decimal - time
          : 0

        processedData.push({
          fincode: result.fincode,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          race_id: selectedRace,
          distance: raceData.distance,
          stroke_short_en: raceData.stroke_short_en,
          meet_date: result.min_date ?? '',
          meet_name: result.meet_name ?? '',
          res_time_decimal: time,
          time_str: result.time_str ?? formatTime(time),
          improvement: improvement,
          best_time: bestTime,
        })
      })

      setProgressData(processedData)
    } catch (error) {
      console.error('Error fetching progress data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchGroupStats() {
    if (!selectedSeason) return

    try {
      // Get all groups
      const { data: groups } = await supabase
        .from('_groups')
        .select('id, group_name')

      if (!groups) return

      const stats: GroupStats[] = []

      for (const group of groups) {
        // Get athletes in this group
        const { data: rosterData } = await supabase
          .from('roster')
          .select('fincode')
          .eq('season_id', selectedSeason.season_id)
          .eq('group', group.group_name)

        if (!rosterData || rosterData.length === 0) continue

        const fincodes = rosterData.map(r => r.fincode)

        // Get all results for these athletes
        const { data: results } = await supabase
          .from('results')
          .select(`
            fincode,
            res_time_decimal,
            meets!inner (
              min_date
            )
          `)
          .in('fincode', fincodes)
          .eq('status', 0)

        if (!results || results.length === 0) continue

        // Calculate improvements for each athlete
        const athleteImprovements = new Map<number, number>()
        
        results.forEach((result: any) => {
          const fincode = result.fincode
          const time = result.res_time_decimal
          
          if (!athleteImprovements.has(fincode)) {
            athleteImprovements.set(fincode, time)
          } else {
            const prevBest = athleteImprovements.get(fincode)!
            if (time < prevBest) {
              athleteImprovements.set(fincode, time)
            }
          }
        })

        const avgImprovement = Array.from(athleteImprovements.values()).reduce((a, b) => a + b, 0) / athleteImprovements.size

        stats.push({
          group_name: group.group_name,
          total_athletes: fincodes.length,
          avg_improvement: avgImprovement,
          total_races: results.length,
        })
      }

      setGroupStats(stats)
    } catch (error) {
      console.error('Error fetching group stats:', error)
    }
  }

  function formatTime(decimal: number): string {
    const totalSeconds = decimal / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(2)
    return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds
  }

  function formatDelta(milliseconds: number): string {
    const sign = milliseconds > 0 ? '-' : '+'
    const abs = Math.abs(milliseconds)
    const totalSeconds = abs / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(2)
    const timeStr = minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds
    return `${sign}${timeStr}s`
  }

  // Calculate statistics
  // Dynamic Y-axis domain to emphasize variation in times
  const yDomain: number[] | undefined = (() => {
    if (!progressData || progressData.length === 0) return undefined
    const values = progressData.map(d => d.res_time_decimal)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    const pad = Math.max(100, Math.floor(range * 0.2))
    return [Math.max(0, min - pad), max + pad]
  })()

  // Y-axis domain for improvement chart (improvements are in ms and often small)
  const yDomainImprovement: number[] | undefined = (() => {
    const impData = progressData && progressData.length > 1 ? progressData.slice(1).map(d => d.improvement) : []
    if (!impData || impData.length === 0) return undefined
    const min = Math.min(...impData)
    const max = Math.max(...impData)
    const range = max - min
    const pad = Math.max(50, Math.floor(range * 0.2))
    return [min - pad, max + pad]
  })()

  return (
    <div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Progress Tracking</h1>
          <p className="text-muted-foreground mt-2">
            Track swimmer progress individually and as a group
          </p>
        </div>

        {/* View Mode Selector */}
        <div className="mb-6">
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'individual' | 'group')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="group">Group</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewMode === 'individual' ? (
          <div>
            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Group</label>
                <Select
                  value={selectedGroup || ''}
                  onValueChange={(value) => setSelectedGroup(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.group_name}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Athlete</label>
                <Select
                  value={selectedAthlete?.toString()}
                  onValueChange={(value) => setSelectedAthlete(parseInt(value))}
                  disabled={!selectedGroup}>

                  <SelectTrigger>
                    <SelectValue placeholder="Select athlete" />
                  </SelectTrigger>
                  <SelectContent>
                    {athletes.map((athlete) => (
                      <SelectItem key={athlete.fincode} value={athlete.fincode.toString()}>
                        {athlete.firstname} {athlete.lastname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Race</label>
                <Select
                  value={selectedRace?.toString()}
                  onValueChange={(value) => setSelectedRace(parseInt(value))}>

                  <SelectTrigger>
                    <SelectValue placeholder="Select race" />
                  </SelectTrigger>
                  <SelectContent>
                    {races.map((race) => (
                      <SelectItem key={race.race_id} value={race.race_id.toString()}>
                        {race.race_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Course</label>
                <Select
                  value={selectedCourse.toString()}
                  onValueChange={(value) => setSelectedCourse(parseInt(value))}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">50m</SelectItem>
                    <SelectItem value="2">25m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p>Loading progress data...</p>
              </div>
            ) : progressData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {selectedAthlete && selectedRace
                    ? 'No progress data available for this athlete and race'
                    : 'Select a group, athlete, and race to view progress'}
                </p>
              </div>
            ) : (
              <>
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 gap-4 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Over Time</CardTitle>
                  <CardDescription>
                    Visualize the swimmer's performance trend and personal bests.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="meet_date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                      <YAxis domain={yDomain ? yDomain : ['dataMin', 'dataMax']} tickFormatter={(value) => `${(value / 1000).toFixed(2)}s`} />
                      <Tooltip
                        labelFormatter={(value: any, payload: any) => {
                          if (payload && Array.isArray(payload) && payload.length > 0) {
                            const data = payload[0].payload;
                            return `${new Date(data.meet_date).toLocaleDateString()} (${data.time_str})`;
                          }
                          return value ? String(value) : '';
                        }}
                        formatter={(value: any, name: string | undefined) => {
                          if (name === 'Time') return [formatTime(value), name];
                          if (value === undefined) return ['', name || ''];
                          return [value, name || ''];
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="res_time_decimal" 
                        stroke="#8884d8" 
                        name="Time"
                        strokeWidth={2}
                        dot={{ r: 5 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="best_time" 
                        stroke="#82ca9d" 
                        name="Personal Best"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Improvement per Meet */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Improvement per Meet</CardTitle>
                  <CardDescription>
                    Time difference from previous meet (negative = improvement)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={progressData.slice(1)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="meet_date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString()}
                      />
                       <YAxis domain={yDomainImprovement ? yDomainImprovement : ['dataMin', 'dataMax']} tickFormatter={(value) => formatDelta(value as number)} />
                      <Tooltip
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: any) => {
                          if (value === undefined) return ['', 'Improvement']
                          return [formatDelta(value), 'Improvement']
                        }}
                      />
                      <Bar dataKey="improvement">
                        {progressData.slice(1).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.improvement > 0 ? '#82ca9d' : '#ff6b6b'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Meet Results Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Meet Results</CardTitle>
                  <CardDescription>
                    Detailed results for each meet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Meet</th>
                          <th className="text-right p-2">Time</th>
                          <th className="text-right p-2">Improvement</th>
                          <th className="text-right p-2">Best Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressData.map((data, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="p-2">{new Date(data.meet_date).toLocaleDateString()}</td>
                            <td className="p-2">{data.meet_name}</td>
                            <td className="text-right p-2">{data.time_str}</td>
                            <td className={`text-right p-2 ${data.improvement > 0 ? 'text-green-600' : data.improvement < 0 ? 'text-red-600' : ''}`}>
                              {index === 0 ? '-' : formatDelta(data.improvement)}
                            </td>
                            <td className="text-right p-2">{formatTime(data.best_time)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
                </div>
            </>
          )}
        </div>
      ) : (
        <div>
          {/* Group Stats */}
          <div className="grid gap-6">
            {/* Group Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Group Performance Overview</CardTitle>
                <CardDescription>
                  Compare performance across different groups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={groupStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="group_name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_athletes" fill="#8884d8" name="Athletes" />
                    <Bar dataKey="total_races" fill="#82ca9d" name="Total Races" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Group Statistics Table */}
            <Card>
              <CardHeader>
                <CardTitle>Group Statistics</CardTitle>
                <CardDescription>
                  Detailed statistics for each group
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Group</th>
                        <th className="text-right p-2">Athletes</th>
                        <th className="text-right p-2">Total Races</th>
                        <th className="text-right p-2">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStats.map((stat, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {stat.group_name}
                          </td>
                          <td className="text-right p-2">{stat.total_athletes}</td>
                          <td className="text-right p-2">{stat.total_races}</td>
                          <td className="text-right p-2">{formatTime(stat.avg_improvement)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default Progress
