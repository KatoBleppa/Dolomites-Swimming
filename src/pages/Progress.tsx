import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Award, Users } from 'lucide-react'
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
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [selectedAthlete, setSelectedAthlete] = useState<number | null>(null)
  const [selectedRace, setSelectedRace] = useState<number | null>(null)
  const [progressData, setProgressData] = useState<ProgressData[]>([])
  const [groupStats, setGroupStats] = useState<GroupStats[]>([])
  const [races, setRaces] = useState<{ race_id: number; race_name: string }[]>([])
  const [viewMode, setViewMode] = useState<'individual' | 'group'>('individual')

  useEffect(() => {
    if (selectedSeason) {
      fetchAthletes()
      fetchRaces()
      fetchGroupStats()
    }
  }, [selectedSeason])

  useEffect(() => {
    if (selectedSeason && selectedAthlete && selectedRace) {
      fetchProgressData()
    }
  }, [selectedSeason, selectedAthlete, selectedRace])

  async function fetchAthletes() {
    if (!selectedSeason) return

    try {
      const { data, error } = await supabase
        .from('roster')
        .select(`
          fincode,
          athletes (firstname, lastname)
        `)
        .eq('season_id', selectedSeason.season_id)

      if (error) throw error

      const athleteList = data?.map((item: any) => ({
        fincode: item.fincode,
        firstname: item.athletes.firstname,
        lastname: item.athletes.lastname,
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

      // Fetch progress data using the new SQL function
      const { data: results, error } = await supabase
        .rpc('progress_data', {
          athlete_fincode: selectedAthlete,
          ms_race: selectedRace,
        })

      if (error) throw error

      // Get athlete info
      const athlete = athletes.find(a => a.fincode === selectedAthlete)
      if (!athlete) return

      // Process results to calculate improvement
      const processedData: ProgressData[] = []
      let bestTime = Infinity

      results?.forEach((result: any) => {
        const time = result.res_time_decimal

        if (time < bestTime) {
          bestTime = time
        }

        const improvement = processedData.length > 0 
          ? processedData[processedData.length - 1].res_time_decimal - time
          : 0

        const meetDate = result.meets?.min_date ?? ''
        const meetName = result.meets?.meet_name ?? ''

        processedData.push({
          fincode: result.fincode,
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          race_id: selectedRace,
          distance: raceData.distance,
          stroke_short_en: raceData.stroke_short_en,
          meet_date: meetDate,
          meet_name: meetName,
          res_time_decimal: time,
          time_str: formatTime(time),
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
    const totalSeconds = decimal / 100
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(2)
    return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds
  }

  // Calculate statistics
  const totalRaces = progressData.length
  const bestTime = progressData.length > 0 ? Math.min(...progressData.map(d => d.res_time_decimal)) : 0
  const avgTime = progressData.length > 0 
    ? progressData.reduce((sum, d) => sum + d.res_time_decimal, 0) / progressData.length 
    : 0
  const totalImprovement = progressData.length > 1 
    ? progressData[0].res_time_decimal - progressData[progressData.length - 1].res_time_decimal 
    : 0

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
        <>
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Athlete</label>
              <Select
                value={selectedAthlete?.toString()}
                onValueChange={(value) => setSelectedAthlete(parseInt(value))}
              >
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
                onValueChange={(value) => setSelectedRace(parseInt(value))}
              >
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
                  : 'Select an athlete and race to view progress'}
              </p>
            </div>
          ) : (
            <>
              {/* Statistics Cards */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Races</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalRaces}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Best Time</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatTime(bestTime)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Time</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatTime(avgTime)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Improvement</CardTitle>
                    {totalImprovement > 0 ? (
                      <TrendingDown className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-600" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${totalImprovement > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalImprovement > 0 ? '-' : '+'}{Math.abs(totalImprovement / 100).toFixed(2)}s
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Timeline Chart */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Performance Over Time</CardTitle>
                  <CardDescription>
                    Time progression across meets (lower is better)
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
                      <YAxis 
                        domain={['dataMin - 100', 'dataMax + 100']}
                        tickFormatter={(value) => formatTime(value)}
                      />
                      <Tooltip
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: any, name: string | undefined) => {
                          if (value === undefined) return ['', name || '']
                          if (name === 'Time') return [formatTime(value), name]
                          return [value, name || '']
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
                      <YAxis tickFormatter={(value) => `${(value / 100).toFixed(2)}s`} />
                      <Tooltip
                        labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        formatter={(value: any) => {
                          if (value === undefined) return ['', 'Improvement']
                          return [`${(value / 100).toFixed(2)}s`, 'Improvement']
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
                              {index === 0 ? '-' : `${data.improvement > 0 ? '-' : '+'}${Math.abs(data.improvement / 100).toFixed(2)}s`}
                            </td>
                            <td className="text-right p-2">{formatTime(data.best_time)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
