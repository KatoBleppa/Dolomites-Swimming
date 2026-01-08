import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Hash, TrendingUp, Download } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import * as XLSX from 'xlsx'

interface PermilliResult {
  res_id: number
  fincode: number
  meet_id: number
  event_numb: number
  ms_race_id: number
  res_time_str: string
  lim_time_str: string
  result_status: string
  athlete_firstname: string
  athlete_lastname: string
  athlete_gender: string
  meet_name: string
  min_date: string
  meet_course: number
  ros_cat_id: number
  note: string
  permillili: number
  race_distance: number
  race_stroke_short: string
}

interface Season {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
}

export function Permillili() {
  const { selectedSeason, seasons } = useSeason()
  const [results, setResults] = useState<PermilliResult[]>([])
  const [loading, setLoading] = useState(false)
  const [currentSeason, setCurrentSeason] = useState<Season | null>(selectedSeason)
  const [course, setCourse] = useState<number>(2) // Default to 25m

  useEffect(() => {
    if (selectedSeason) {
      setCurrentSeason(selectedSeason)
    }
  }, [selectedSeason])

  useEffect(() => {
    if (currentSeason) {
      fetchPermillili()
    }
  }, [currentSeason, course])

  async function fetchPermillili() {
    if (!currentSeason) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase.rpc('get_best_permillili', {
        p_season_id: currentSeason.season_id,
        p_course: course
      })

      if (error) {
        console.error('Error fetching permillili:', error)
        throw error
      }
      
      console.log('Permillili data fetched:', data?.length, 'records')
      // Sort by permillili descending (highest points first)
      const sortedData = (data || []).sort((a: PermilliResult, b: PermilliResult) => b.permillili - a.permillili)
      setResults(sortedData)
    } catch (error) {
      console.error('Error fetching permillili:', error)
    } finally {
      setLoading(false)
    }
  }

  function exportToExcel() {
    if (results.length === 0) return

    // Prepare data for export
    const exportData = results.map((result, index) => ({
      'Rank': index + 1,
      'First Name': result.athlete_firstname,
      'Last Name': result.athlete_lastname,
      'FIN Code': result.fincode,
      'Gender': result.athlete_gender,
      'Distance': result.race_distance,
      'Stroke': result.race_stroke_short,
      'Result': result.res_time_str,
      'Limit': result.lim_time_str,
      'Points': result.permillili,
      'Meet': result.meet_name,
      'Date': result.min_date,
      'Course': course === 1 ? '50m' : '25m'
    }))

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Permillili Rankings')

    // Set column widths
    const colWidths = [
      { wch: 6 },  // Rank
      { wch: 12 }, // First Name
      { wch: 12 }, // Last Name
      { wch: 10 }, // FIN Code
      { wch: 8 },  // Gender
      { wch: 10 }, // Distance
      { wch: 10 }, // Stroke
      { wch: 10 }, // Result
      { wch: 10 }, // Limit
      { wch: 8 },  // Points
      { wch: 30 }, // Meet
      { wch: 12 }, // Date
      { wch: 8 }   // Course
    ]
    ws['!cols'] = colWidths

    // Generate filename with season and course info
    const courseType = course === 1 ? 'LC' : 'SC'
    const filename = `Permillili_${currentSeason?.season_name}_${courseType}_${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Save file
    XLSX.writeFile(wb, filename)
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Hash className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Permillili Rankings</h1>
          </div>
          {results.length > 0 && (
            <Button onClick={exportToExcel} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Best qualifying points for each swimmer
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select season and course type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Season Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-2">Season</label>
              <select
                className="w-full px-3 py-2 border rounded-md bg-background"
                value={currentSeason?.season_id || ''}
                onChange={(e) => {
                  const season = seasons.find(s => s.season_id === Number(e.target.value))
                  setCurrentSeason(season || null)
                }}
              >
                {seasons.map((season) => (
                  <option key={season.season_id} value={season.season_id}>
                    {season.season_name}
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

      {/* Results */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Loading permillili data...
            </div>
          </CardContent>
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No permillili data available for the selected season and course
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Best Permillili ({results.length} athletes)
            </CardTitle>
            <CardDescription>
              Showing best permillili
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Rank</th>
                    <th className="text-left py-3 px-4 font-medium">Athlete</th>
                    <th className="text-left py-3 px-4 font-medium">Gender</th>
                    <th className="text-left py-3 px-4 font-medium">Event</th>
                    <th className="text-right py-3 px-4 font-medium">Result</th>
                    <th className="text-right py-3 px-4 font-medium">Limit</th>
                    <th className="text-right py-3 px-4 font-medium">Points</th>
                    <th className="text-left py-3 px-4 font-medium">Meet</th>
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={result.res_id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-semibold">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {result.athlete_firstname} {result.athlete_lastname}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          FIN: {result.fincode}
                        </div>
                      </td>
                      <td className="py-3 px-4">{result.athlete_gender}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {result.race_distance}m {result.race_stroke_short}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {result.res_time_str}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {result.lim_time_str}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${
                          result.permillili >= 1000 ? 'text-green-600' : 
                          result.permillili >= 900 ? 'text-blue-600' : 
                          'text-orange-600'
                        }`}>
                          {result.permillili}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{result.meet_name}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {result.min_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {results.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Points Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-600">≥1000</span>
                <span className="text-muted-foreground">Excellent</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-600">900-999</span>
                <span className="text-muted-foreground">Good</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-600">&lt;900</span>
                <span className="text-muted-foreground">Improving</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
