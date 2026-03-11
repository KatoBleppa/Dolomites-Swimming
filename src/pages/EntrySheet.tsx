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
  split_times_str: string[]
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
  entries: (IndividualEntry | RelayEntry)[]
}

interface IndividualEntry {
  type: 'individual'
  res_id: number
  fincode: number
  firstname: string
  lastname: string
  birthdate: string
  entry_time_str: string
  lim_time_str: string | null
  split_times_str: string[]
}

interface RelayLegInfo {
  legNumber: 1 | 2 | 3 | 4
  fincode: number
  firstname: string | null
  lastname: string | null
  entry_time_str: string
}

interface RelayEntry {
  type: 'relay'
  relay_result_id: number
  relay_name: string
  legs: RelayLegInfo[]
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
            type: 'individual',
            res_id: row.res_id!,
            fincode: row.fincode,
            firstname: row.firstname,
            lastname: row.lastname,
            birthdate: row.birthdate!,
            entry_time_str: row.entry_time_str || 'NT',
            lim_time_str: row.lim_time_str,
            split_times_str: row.split_times_str || []
          })
        }
      })

      const { data: relayData, error: relayError } = await supabase
        .from('relay_results')
        .select('relay_result_id, event_numb, relay_name, leg1_fincode, leg1_entry_time, leg2_fincode, leg2_entry_time, leg3_fincode, leg3_entry_time, leg4_fincode, leg4_entry_time')
        .eq('meet_id', parseInt(meetId))

      if (relayError) throw relayError

      if (relayData && relayData.length > 0) {
        const relayFincodes = new Set<number>()
        relayData.forEach(relay => {
          relayFincodes.add(relay.leg1_fincode)
          relayFincodes.add(relay.leg2_fincode)
          relayFincodes.add(relay.leg3_fincode)
          relayFincodes.add(relay.leg4_fincode)
        })

        const { data: relayAthletes, error: relayAthletesError } = await supabase
          .from('athletes')
          .select('fincode, firstname, lastname')
          .in('fincode', Array.from(relayFincodes))

        if (relayAthletesError) throw relayAthletesError

        const relayAthleteMap = new Map(relayAthletes?.map(a => [a.fincode, a]) || [])

        relayData.forEach(relay => {
          const event = eventsMap.get(relay.event_numb)
          if (!event) return

          const legs: RelayLegInfo[] = [
            { legNumber: 1, fincode: relay.leg1_fincode, firstname: relayAthleteMap.get(relay.leg1_fincode)?.firstname || null, lastname: relayAthleteMap.get(relay.leg1_fincode)?.lastname || null, entry_time_str: millisecondsToTimeString(relay.leg1_entry_time) },
            { legNumber: 2, fincode: relay.leg2_fincode, firstname: relayAthleteMap.get(relay.leg2_fincode)?.firstname || null, lastname: relayAthleteMap.get(relay.leg2_fincode)?.lastname || null, entry_time_str: millisecondsToTimeString(relay.leg2_entry_time) },
            { legNumber: 3, fincode: relay.leg3_fincode, firstname: relayAthleteMap.get(relay.leg3_fincode)?.firstname || null, lastname: relayAthleteMap.get(relay.leg3_fincode)?.lastname || null, entry_time_str: millisecondsToTimeString(relay.leg3_entry_time) },
            { legNumber: 4, fincode: relay.leg4_fincode, firstname: relayAthleteMap.get(relay.leg4_fincode)?.firstname || null, lastname: relayAthleteMap.get(relay.leg4_fincode)?.lastname || null, entry_time_str: millisecondsToTimeString(relay.leg4_entry_time) }
          ]

          event.entries.push({
            type: 'relay',
            relay_result_id: relay.relay_result_id,
            relay_name: relay.relay_name,
            legs
          })
        })
      }

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

  function millisecondsToTimeString(ms: number | null): string {
    if (!ms || ms <= 0) return 'NT'
    const totalSeconds = ms / 1000.0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const centiseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
  }

  function getIndividualEntryLayout(distance: number): { splitCount: number; columns: number } {
    if (distance <= 100) {
      return { splitCount: 2, columns: 4 }
    }

    if (distance === 200) {
      return { splitCount: 4, columns: 2 }
    }

    return { splitCount: 0, columns: 1 }
  }

  function getGridColumnsClass(columns: number): string {
    if (columns === 4) return 'grid-cols-4'
    if (columns === 2) return 'grid-cols-2'
    return 'grid-cols-1'
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
            font-size: 12px;
            width: 100%;
          }
          .print-content th,
          .print-content td {
            padding: 2px 4px !important;
          }
          .print-content .split-time-cell,
          .print-content .split-number-cell {
            font-size: 11px !important;
            line-height: 1 !important;
            white-space: nowrap;
          }
          .print-content .event-card {
            page-break-inside: auto;
            break-inside: auto;
            page-break-after: auto;
            break-after: auto;
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
          .print-content .entry-name {
            display: inline-block;
            max-width: 10ch;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
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
                (() => {
                  const individualEntries = event.entries.filter((entry): entry is IndividualEntry => entry.type === 'individual')
                  const relayEntries = event.entries.filter((entry): entry is RelayEntry => entry.type === 'relay')
                  const layout = getIndividualEntryLayout(event.distance)

                  return (
                    <div className="space-y-4">
                      {individualEntries.length > 0 && (
                        <div className={`grid gap-4 ${getGridColumnsClass(layout.columns)}`}>
                          {individualEntries.map((entry, index) => (
                            <div key={entry.res_id} className="border rounded-lg p-3">
                              {(() => {
                                const expectedDistanceSplits = Math.floor(event.distance / 50)
                                const splitRows = event.distance > 200
                                  ? Math.max(expectedDistanceSplits, entry.split_times_str.length, 1)
                                  : layout.splitCount
                                const splitColumns = event.distance > 200 ? 4 : 1
                                const rowsPerColumn = Math.ceil(splitRows / splitColumns)

                                return (
                                  <>
                              {layout.columns === 4 ? (
                                <div className="mb-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                    <span className="entry-name text-base font-semibold" title={`${entry.lastname} ${entry.firstname}`}>
                                      {entry.lastname} {entry.firstname}
                                    </span>
                                  </div>
                                  <div className="font-mono text-sm font-semibold">PB {entry.entry_time_str}</div>
                                  <div className="font-mono text-sm text-muted-foreground">LIM {entry.lim_time_str || '-'}</div>
                                </div>
                              ) : (
                                <div className="mb-2 grid grid-cols-3 items-center gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                    <span className="entry-name text-base font-semibold truncate" title={`${entry.lastname} ${entry.firstname}`}>
                                      {entry.lastname} {entry.firstname}
                                    </span>
                                  </div>
                                  <div className="font-mono text-sm font-semibold text-center">PB {entry.entry_time_str}</div>
                                  <div className="font-mono text-sm text-muted-foreground text-right">LIM {entry.lim_time_str || '-'}</div>
                                </div>
                              )}

                              <div className={splitColumns === 4 ? 'grid grid-cols-4 gap-2' : ''}>
                                {[...Array(splitColumns)].map((_, columnIndex) => (
                                  <table key={columnIndex} className="w-full table-fixed border-collapse">
                                    <tbody>
                                      {[...Array(rowsPerColumn)].map((_, rowIndex) => {
                                        const splitIndex = columnIndex * rowsPerColumn + rowIndex
                                        if (splitIndex >= splitRows) return null

                                        return (
                                          <tr key={splitIndex} className="hover:bg-muted/50">
                                            <td className="split-number-cell w-6 py-1 px-1 text-center align-middle font-medium text-xs border bg-muted/30">{splitIndex + 1}</td>
                                            <td className="split-time-cell py-1 px-2 text-center align-middle leading-none font-mono text-sm border">
                                              {entry.split_times_str[splitIndex] || '\u00A0'}
                                            </td>
                                            <td className="py-1 px-2 align-middle border">
                                              <div className={`${layout.columns === 4 ? 'h-6' : 'h-7'}`}></div>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                ))}
                              </div>
                                  </>
                                )
                              })()}
                            </div>
                          ))}
                        </div>
                      )}

                      {relayEntries.map((entry, index) => (
                        <div key={entry.relay_result_id} className="border rounded-lg p-3">
                          <div className="mb-2 flex items-center gap-4">
                            <span className="text-sm font-medium text-muted-foreground">#{individualEntries.length + index + 1}</span>
                            <span className="text-base font-semibold">{entry.relay_name}</span>
                            <span className="text-sm text-muted-foreground">Relay</span>
                          </div>
                          <table className="w-full table-fixed border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium text-xs border w-1/12">Leg</th>
                                <th className="text-left py-2 px-3 font-medium text-xs border">Athlete</th>
                                <th className="text-center py-2 px-3 font-medium text-xs border w-1/6">PB</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.legs.map(leg => (
                                <tr key={leg.legNumber} className="hover:bg-muted/50">
                                  <td className="py-2 px-3 border text-sm font-medium">{leg.legNumber}</td>
                                  <td className="py-2 px-3 border text-sm">
                                    {leg.lastname && leg.firstname ? `${leg.lastname} ${leg.firstname}` : 'Unknown athlete'}
                                  </td>
                                  <td className="py-2 px-3 border text-center font-mono text-sm">
                                    {leg.entry_time_str}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )
                })()
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
