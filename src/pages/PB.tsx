import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Award, Download } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import { Button } from '@/components/ui/button'
import * as XLSX from 'xlsx'

interface Race {
  race_id: number
  distance: number
  stroke_short_en: string
}

interface PersonalBest {
  fincode: number
  firstname: string
  lastname: string
  race_id: number
  distance: number
  stroke_short_en: string
  best_time_decimal: number
  best_time_str: string
  meet_name?: string
  meet_date?: string
  meet_location?: string
}

interface Group {
  id: number
  group_name: string
}

interface AthleteRow {
  fincode: number
  firstname: string
  lastname: string
  [key: string]: string | number | PersonalBest // For dynamic race columns
}

export function PB() {
  const { selectedSeason } = useSeason()
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number>(1)
  const [course, setCourse] = useState<number>(2) // Default to 25m
  const [races, setRaces] = useState<Race[]>([])
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([])
  const [tableData, setTableData] = useState<AthleteRow[]>([])

  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    if (selectedSeason) {
      fetchRaces()
      fetchPersonalBests()
    }
  }, [selectedSeason, selectedGroupId, course])

  async function fetchGroups() {
    try {
      const { data, error } = await supabase
        .from('_groups')
        .select('id, group_name')
        .order('id')

      if (error) throw error
      setGroups(data || [])
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  async function fetchRaces() {
    try {
      // Fetch all unique races from _races table
      const { data, error } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en')
        .order('race_id', { ascending: true })

      if (error) throw error
      setRaces(data || [])
    } catch (error) {
      console.error('Error fetching races:', error)
    }
  }

  async function fetchPersonalBests() {
    if (!selectedSeason) return

    try {
      setLoading(true)

      // Call the SQL function to get personal bests
      const { data, error } = await supabase
        .rpc('get_personal_bests', {
          p_season_id: selectedSeason.season_id,
          p_group_id: selectedGroupId,
          p_course: course
        })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Transform the data and format times
      const pbArray: PersonalBest[] = (data || []).map((row: any) => ({
        fincode: row.fincode,
        firstname: row.firstname,
        lastname: row.lastname,
        race_id: row.race_id,
        distance: row.distance,
        stroke_short_en: row.stroke_short_en,
        best_time_decimal: row.best_time_decimal,
        best_time_str: row.pb_str,
        meet_name: row.meet_name,
        meet_date: row.meet_date,
        meet_location: row.meet_location
      }))

      setPersonalBests(pbArray)

      // Transform data into table format
      buildTableData(pbArray)

    } catch (error) {
      console.error('Error fetching personal bests:', error)
    } finally {
      setLoading(false)
    }
  }

  function buildTableData(pbArray: PersonalBest[]) {
    // Get unique athletes
    const athletesMap = new Map<number, AthleteRow>()

    pbArray.forEach(pb => {
      if (!athletesMap.has(pb.fincode)) {
        athletesMap.set(pb.fincode, {
          fincode: pb.fincode,
          firstname: pb.firstname,
          lastname: pb.lastname
        })
      }

      // Add the best time for this race - store the full PB object
      const athlete = athletesMap.get(pb.fincode)!
      const raceKey = `${pb.distance}m ${pb.stroke_short_en}`
      athlete[raceKey] = pb
    })

    // Convert map to array and sort by last name
    const tableArray = Array.from(athletesMap.values()).sort((a, b) => 
      a.lastname.localeCompare(b.lastname)
    )

    setTableData(tableArray)
  }

  function exportToExcel() {
    if (tableData.length === 0) return

    // Prepare data for export
    const exportData = tableData.map(athlete => {
      const row: any = {
        'First Name': athlete.firstname,
        'Last Name': athlete.lastname,
        'FIN Code': athlete.fincode
      }

      // Add all race times
      races.forEach(race => {
        const raceKey = `${race.distance}m ${race.stroke_short_en}`
        const pb = athlete[raceKey] as PersonalBest
        row[raceKey] = pb?.best_time_str || '-'
      })

      return row
    })

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personal Bests')

    // Generate filename
    const groupName = groups.find(g => g.id === selectedGroupId)?.group_name || 'All'
    const courseType = course === 1 ? 'LC' : 'SC'
    const filename = `Personal_Bests_${selectedSeason?.season_name}_${groupName}_${courseType}_${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Save file
    XLSX.writeFile(wb, filename)
  }

  // Get unique races from the personal bests data (only races with data)
  // Filter to unique distance/stroke combinations to avoid duplicates
  const activeRaces = races
    .filter(race => {
      const raceKey = `${race.distance}m ${race.stroke_short_en}`
      return tableData.some(athlete => athlete[raceKey])
    })
    .filter((race, index, self) => 
      index === self.findIndex(r => 
        r.distance === race.distance && r.stroke_short_en === race.stroke_short_en
      )
    )

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Award className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Personal Bests</h1>
          </div>
          {tableData.length > 0 && (
            <Button onClick={exportToExcel} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Best times for each swimmer in each race
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select group and course type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Group Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-2">Group</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Course Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-2">Course</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={course}
                onChange={(e) => setCourse(Number(e.target.value))}
              >
                <option value={1}>Long Course (50m)</option>
                <option value={2}>Short Course (25m)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Loading personal bests...
            </div>
          </CardContent>
        </Card>
      ) : tableData.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No personal bests data available for the selected group and course
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Personal Bests Table</CardTitle>
            <CardDescription>
              {tableData.length} athletes · {activeRaces.length} races
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full border-collapse mt-4">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium sticky left-0 bg-muted/50 z-10">
                      Athlete
                    </th>
                    {activeRaces.map(race => (
                      <th 
                        key={race.race_id} 
                        className="text-center py-3 px-3 font-medium min-w-[80px]"
                      >
                        <div className="text-xs">
                          {race.distance}m
                        </div>
                        <div className="text-xs font-normal">
                          {race.stroke_short_en}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((athlete) => (
                    <tr key={athlete.fincode} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-4 sticky left-0 bg-background z-10">
                        <div className="font-medium text-sm whitespace-nowrap">
                          {athlete.lastname} {athlete.firstname}
                        </div>
                      </td>
                      {activeRaces.map(race => {
                        const raceKey = `${race.distance}m ${race.stroke_short_en}`
                        const pb = athlete[raceKey] as PersonalBest
                        return (
                          <td 
                            key={race.race_id} 
                            className="py-2 px-3 text-center font-mono text-sm relative group"
                          >
                            {pb ? (
                              <>
                                <span className="cursor-help">
                                  {pb.best_time_str}
                                </span>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                                  <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 min-w-[200px] text-left">
                                    <div className="text-xs font-semibold mb-1">
                                      {pb.meet_name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {pb.meet_date && new Date(pb.meet_date).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </div>
                                    {pb.meet_location && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        📍 {pb.meet_location}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
