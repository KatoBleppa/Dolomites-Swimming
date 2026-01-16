import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { FileText, Calendar, MapPin, Printer } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import { Button } from '@/components/ui/button'

interface EntrySheetData {
  // Meet details
  meet_id: number
  meet_name: string
  place: string
  meet_course: number
  min_date: string
  
  // Event details
  event_numb: number
  race_id: number
  distance: number
  stroke_short_en: string
  group_name: string
  gender: string
  
  // Entry details
  res_id: number | null
  fincode: number | null
  firstname: string | null
  lastname: string | null
  birthdate: string | null
  entry_time_decimal: number | null
  entry_time_str: string | null
  lim_time_dec: number | null
  lim_time_str: string | null
}

interface MeetInfo {
  meet_name: string
  place: string
  meet_course: number
  min_date: string
}

interface EventEntries {
  event_numb: number
  race_id: number
  distance: number
  stroke_short_en: string
  group_name: string
  gender: string
  entries: {
    res_id: number
    fincode: number
    firstname: string
    lastname: string
    birthdate: string
    entry_time_str: string
    lim_time_str: string | null
  }[]
}

export function EntrySheet() {
  const [searchParams] = useSearchParams()
  const meetId = searchParams.get('meet_id')
  const { selectedSeason } = useSeason()
  
  const [loading, setLoading] = useState(false)
  const [meetInfo, setMeetInfo] = useState<MeetInfo | null>(null)
  const [eventEntries, setEventEntries] = useState<EventEntries[]>([])

  useEffect(() => {
    if (meetId) {
      fetchEntrySheetData()
    }
  }, [meetId])

  async function fetchEntrySheetData() {
    if (!meetId || !selectedSeason) return

    try {
      setLoading(true)

      const { data, error } = await supabase
        .rpc('entry_sheet_data', {
          p_meet_id: parseInt(meetId),
          p_season_id: selectedSeason.season_id
        })

      if (error) throw error

      if (!data || data.length === 0) {
        return
      }

      // Extract meet info from first row
      const firstRow = data[0]
      setMeetInfo({
        meet_name: firstRow.meet_name,
        place: firstRow.place,
        meet_course: firstRow.meet_course,
        min_date: firstRow.min_date
      })

      // Group entries by event
      const eventsMap = new Map<number, EventEntries>()
      
      data.forEach((row: EntrySheetData) => {
        const eventKey = row.event_numb
        
        if (!eventsMap.has(eventKey)) {
          eventsMap.set(eventKey, {
            event_numb: row.event_numb,
            race_id: row.race_id,
            distance: row.distance,
            stroke_short_en: row.stroke_short_en,
            group_name: row.group_name,
            gender: row.gender,
            entries: []
          })
        }

        // Add entry if athlete data exists
        if (row.fincode && row.firstname && row.lastname) {
          eventsMap.get(eventKey)!.entries.push({
            res_id: row.res_id!,
            fincode: row.fincode,
            firstname: row.firstname,
            lastname: row.lastname,
            birthdate: row.birthdate!,
            entry_time_str: row.entry_time_str || 'NT',
            lim_time_str: row.lim_time_str
          })
        }
      })

      setEventEntries(Array.from(eventsMap.values()))
    } catch (error) {
      console.error('Error fetching entry sheet data:', error)
    } finally {
      setLoading(false)
    }
  }

  function getCourseLabel(course: number): string {
    return course === 1 ? '50m' : '25m'
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  function handlePrint() {
    // Add print class to enable print styles
    document.body.classList.add('printing')
    window.print()
    // Remove print class after print dialog closes
    setTimeout(() => document.body.classList.remove('printing'), 100)
  }

  if (!meetId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No meet selected</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p>Loading entry sheet...</p>
      </div>
    )
  }

  if (!meetInfo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No data available for this meet</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 0.5cm;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-hide {
            display: none !important;
          }
          .print-content table {
            font-size: 9px;
            width: 100%;
          }
          .print-content th,
          .print-content td {
            padding: 2px 4px !important;
          }
          .print-content .event-card {
            page-break-inside: avoid;
            margin-bottom: 12px;
            border: 1px solid #ccc;
          }
          .print-content .event-header {
            font-size: 11px;
            font-weight: bold;
            padding: 4px 8px;
            background: #f5f5f5;
            border-bottom: 1px solid #ccc;
          }
        }
      `}</style>
      <div className="mb-8 flex items-start justify-between print-hide">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Entry Sheet
          </h1>
          <p className="text-muted-foreground mt-2">
            Complete entry list for the meet
          </p>
        </div>
        <Button onClick={handlePrint} className="print:hidden">
          <Printer className="h-4 w-4 mr-2" />
          Export as PDF
        </Button>
      </div>

      {/* Meet Information */}
      <Card className="mb-6 print-hide">
        <CardHeader>
          <CardTitle>{meetInfo.meet_name}</CardTitle>
          <CardDescription>
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{meetInfo.place}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(meetInfo.min_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Course:</span>
                <span>{getCourseLabel(meetInfo.meet_course)}</span>
              </div>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Events and Entries */}
      <div className="print-content">
        {/* Print header - only visible when printing */}
        <div className="hidden print:block mb-4">
          <h1 className="text-lg font-bold">{meetInfo.meet_name}</h1>
          <p className="text-sm">{meetInfo.place} • {formatDate(meetInfo.min_date)} • {getCourseLabel(meetInfo.meet_course)}</p>
        </div>
        
        <div className="space-y-6">
        {eventEntries.map((event) => (
          <div key={event.event_numb} className="event-card">
            <Card className="print:border-0 print:shadow-none">
            <CardHeader className="print:p-0">
              <div className="event-header">
                <div className="text-xl print:text-xs font-semibold">
                  Event {event.event_numb}: {event.distance}m {event.stroke_short_en}
                </div>
                <div className="text-sm print:text-xs text-muted-foreground print:text-black">
                  {event.group_name} • {event.gender === 'M' ? 'Men' : (event.gender === 'F' || event.gender === 'W') ? 'Women' : event.gender === 'X' ? 'Mix' : 'Mixed'} • {event.entries.length} {event.entries.length === 1 ? 'entry' : 'entries'}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {event.entries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No entries for this event</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4 font-medium">#</th>
                        <th className="text-left py-2 px-4 font-medium">Name</th>
                        <th className="text-right py-2 px-4 font-medium">Entry Time</th>
                        <th className="text-right py-2 px-4 font-medium">Limit Time</th>
                        <th className="text-center py-2 px-2 font-medium w-12">1</th>
                        <th className="text-center py-2 px-2 font-medium w-12">2</th>
                        <th className="text-center py-2 px-2 font-medium w-12">3</th>
                        <th className="text-center py-2 px-2 font-medium w-12">4</th>
                        <th className="text-center py-2 px-2 font-medium w-12">5</th>
                        <th className="text-center py-2 px-2 font-medium w-12">6</th>
                        <th className="text-center py-2 px-2 font-medium w-12">7</th>
                        <th className="text-center py-2 px-2 font-medium w-12">8</th>
                      </tr>
                    </thead>
                    <tbody>
                      {event.entries.map((entry, index) => (
                        <tr key={entry.res_id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-4">{index + 1}</td>
                          <td className="py-2 px-4">
                            {entry.lastname} {entry.firstname}
                          </td>
                          <td className="py-2 px-4 text-right font-mono">
                            {entry.entry_time_str}
                          </td>
                          <td className="py-2 px-4 text-right font-mono">
                            {entry.lim_time_str || '-'}
                          </td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                          <td className="py-2 px-2 border-l"><div className="h-8 w-12"></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        ))}
        </div>
      </div>

      {eventEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No events or entries found for this meet</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
