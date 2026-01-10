import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, XCircle, Eye, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ImportResult {
  success: boolean
  message: string
  details?: {
    athletesImported: number
    resultsImported: number
    splitsImported?: number
    errors: string[]
  }
}

interface PreviewData {
  meet: {
    meetName: string
    city: string
    nation: string
    date: string
    course: string
    poolName: string
  }
  events: Array<{
    eventId: string
    eventNumber: number
    distance: number
    stroke: string
    gender: string
    relayCount: number
  }>
  athletes: Array<{
    fincode: number
    firstname: string
    lastname: string
    gender: string
    birthdate: string
    resultsCount: number
  }>
  totalResults: number
}

interface DatabaseMeet {
  meet_id: number
  meet_name: string
  place: string
  min_date: string
  max_date: string
  meet_course: number
}

interface DatabaseRace {
  race_id: number
  distance: number
  stroke_short_en: string
  stroke_long_en: string
  relay_count: number
}

interface DatabaseEvent {
  event_numb: number
  ms_race_id: number
  gender: string
  race?: DatabaseRace
}

interface EventMapping {
  eventId: string
  eventNumber: number  // This will be the FILE event number for new meets, DB event_numb for existing meets
  fileEvent: {
    distance: number
    stroke: string
    gender: string
    relayCount: number
  }
  dbRaceId: number | null
  dbRace: DatabaseRace | null
  dbEventNumb: number | null  // The actual database event number (for existing meets)
  status: 'matched' | 'unmatched' | 'conflict'
}

interface AthleteMapping {
  fincode: number
  fileAthlete: {
    firstname: string
    lastname: string
    gender: string
    birthdate: string
  }
  dbAthlete: {
    firstname: string
    lastname: string
    gender: string
    birthdate: string
  } | null
  status: 'matched' | 'new' | 'conflict'
}

type WizardStep = 'upload' | 'preview' | 'selectMeet' | 'mapEvents' | 'mapAthletes' | 'import' | 'complete'

export function ImportLenex() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [xmlDoc, setXmlDoc] = useState<Document | null>(null)
  
  // New state for meet selection and mapping
  const [availableMeets, setAvailableMeets] = useState<DatabaseMeet[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(null)
  const [createNewMeet, setCreateNewMeet] = useState(false)
  const [eventMappings, setEventMappings] = useState<EventMapping[]>([])
  const [athleteMappings, setAthleteMappings] = useState<AthleteMapping[]>([])
  const [availableRaces, setAvailableRaces] = useState<DatabaseRace[]>([])
  const [databaseEvents, setDatabaseEvents] = useState<DatabaseEvent[]>([])

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      setPreviewData(null)
      setCurrentStep('upload')
    }
  }

  async function handleParseFile() {
    if (!selectedFile) return

    try {
      const text = await selectedFile.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(text, 'text/xml')

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        throw new Error('Invalid XML file')
      }

      // Parse the Lenex file
      const meet = doc.querySelector('MEET')
      if (!meet) {
        throw new Error('No MEET element found in file')
      }

      setXmlDoc(doc)

      // Extract preview data
      const meetName = meet.getAttribute('name') || 'Unnamed Meet'
      const meetCity = meet.getAttribute('city') || ''
      const meetNation = meet.getAttribute('nation') || ''
      const meetCourse = meet.getAttribute('course') === 'SCM' ? '25m (Short Course)' : '50m (Long Course)'
      
      const session = meet.querySelector('SESSION')
      const meetDate = session?.getAttribute('date') || ''

      const pool = meet.querySelector('POOL')
      const poolName = pool?.getAttribute('name') || ''

      // Get events
      const events = Array.from(meet.querySelectorAll('EVENT'))
      const eventsList = events.map(event => ({
        eventId: event.getAttribute('eventid') || '',
        eventNumber: parseInt(event.getAttribute('number') || '0'),
        distance: parseInt(event.querySelector('SWIMSTYLE')?.getAttribute('distance') || '0'),
        stroke: event.querySelector('SWIMSTYLE')?.getAttribute('stroke') || '',
        gender: event.getAttribute('gender') || '',
        relayCount: parseInt(event.querySelector('SWIMSTYLE')?.getAttribute('relaycount') || '1')
      })) // Include both individual and relay events

      // Get athletes
      const clubs = Array.from(meet.querySelectorAll('CLUB'))
      const athletesList: PreviewData['athletes'] = []
      let totalResults = 0

      for (const club of clubs) {
        const athletes = Array.from(club.querySelectorAll('ATHLETE'))
        
        for (const athlete of athletes) {
          const fincode = parseInt(athlete.getAttribute('license') || '0')
          if (!fincode) continue

          const results = Array.from(athlete.querySelectorAll('RESULT'))
          // Count all results (both individual and relay)

          athletesList.push({
            fincode,
            firstname: athlete.getAttribute('firstname') || '',
            lastname: athlete.getAttribute('lastname') || '',
            gender: athlete.getAttribute('gender') || '',
            birthdate: athlete.getAttribute('birthdate') || '',
            resultsCount: results.length
          })

          totalResults += results.length
        }
      }

      setPreviewData({
        meet: {
          meetName,
          city: meetCity,
          nation: meetNation,
          date: meetDate,
          course: meetCourse,
          poolName
        },
        events: eventsList,
        athletes: athletesList,
        totalResults
      })

      setCurrentStep('preview')

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to parse file')
    }
  }

  async function handleProceedFromPreview() {
    if (!previewData) return
    
    // Check if meet already exists
    const { data: existingMeets } = await supabase
      .from('meets')
      .select('meet_id, meet_name, place, min_date, max_date, meet_course')
      .order('min_date', { ascending: false })
      .limit(20)
    
    setAvailableMeets(existingMeets || [])
    
    // Check for exact match
    const exactMatch = existingMeets?.find(m => 
      m.meet_name === previewData.meet.meetName && 
      m.min_date === previewData.meet.date
    )
    
    if (exactMatch) {
      setSelectedMeetId(exactMatch.meet_id)
      setCreateNewMeet(false)
    }
    
    setCurrentStep('selectMeet')
  }

  async function handleProceedFromMeetSelection() {
    if (!previewData || (!selectedMeetId && !createNewMeet)) return
    
    let races: DatabaseRace[] = []
    let dbEvents: DatabaseEvent[] = []
    
    // Helper function to normalize stroke names for matching
    const normalizeStroke = (stroke: string): string => {
      const normalized = stroke.toLowerCase().trim()
      // Map common variations
      if (normalized === 'free' || normalized === 'freestyle') {
        return 'freestyle'
      }
      return normalized
    }
    
    // Helper function to normalize gender codes (F from file -> W for database)
    const normalizeGender = (gender: string): string => {
      const normalized = gender.toUpperCase().trim()
      if (normalized === 'F') {
        return 'W'  // Female -> Women
      }
      return normalized  // M stays as M
    }
    
    if (createNewMeet) {
      // Load all available races for new meet (both individual and relay)
      const { data: allRaces } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count')
        .order('race_id')
      
      races = allRaces || []
      
      // For new meets, auto-match events based on distance, stroke, and relay_count
      const mappings: EventMapping[] = previewData.events.map(event => {
        const matchedRace = races.find(r => 
          r.distance === event.distance &&
          normalizeStroke(r.stroke_long_en) === normalizeStroke(event.stroke) &&
          r.relay_count === event.relayCount
        )
        
        return {
          eventId: event.eventId,
          eventNumber: event.eventNumber,  // Use file event number for new meets
          fileEvent: {
            distance: event.distance,
            stroke: event.stroke,
            gender: normalizeGender(event.gender),
            relayCount: event.relayCount
          },
          dbRaceId: matchedRace?.race_id || null,
          dbRace: matchedRace || null,
          dbEventNumb: null,  // No database event number yet
          status: matchedRace ? 'matched' : 'unmatched'
        }
      })
      
      setEventMappings(mappings)
    } else {
      // Load existing events from the selected meet with race details
      const { data: meetEventsData } = await supabase
        .from('events')
        .select(`
          event_numb,
          ms_race_id,
          gender
        `)
        .eq('meet_id', selectedMeetId)
        .order('event_numb')
      
      if (meetEventsData && meetEventsData.length > 0) {
        // Fetch race details for these events
        const raceIds = [...new Set(meetEventsData.map(e => e.ms_race_id))]
        const { data: racesData } = await supabase
          .from('_races')
          .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count')
          .in('race_id', raceIds)
        
        const raceMap = new Map((racesData || []).map(r => [r.race_id, r]))
        
        dbEvents = meetEventsData.map(e => ({
          event_numb: e.event_numb,
          ms_race_id: e.ms_race_id,
          gender: e.gender,
          race: raceMap.get(e.ms_race_id)
        }))
        
        races = racesData || []
      }
      
      // Also load all races as fallback options for manual mapping (both individual and relay)
      const { data: allRaces } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count')
        .order('race_id')
      
      // Combine races (remove duplicates)
      const existingRaceIds = new Set(races.map(r => r.race_id))
      const additionalRaces = (allRaces || []).filter(r => !existingRaceIds.has(r.race_id))
      races = [...races, ...additionalRaces]
      
      // Auto-match file events to database events based on distance, stroke, gender, AND relay_count
      const mappings: EventMapping[] = previewData.events.map(event => {
        const matchedDbEvent = dbEvents.find(dbE => {
          const race = dbE.race
          return race && 
            race.distance === event.distance &&
            normalizeStroke(race.stroke_long_en) === normalizeStroke(event.stroke) &&
            dbE.gender === normalizeGender(event.gender) &&
            race.relay_count === event.relayCount
        })
        
        if (matchedDbEvent) {
          return {
            eventId: event.eventId,
            eventNumber: matchedDbEvent.event_numb,  // Use DATABASE event number
            fileEvent: {
              distance: event.distance,
              stroke: event.stroke,
              gender: normalizeGender(event.gender),
              relayCount: event.relayCount
            },
            dbRaceId: matchedDbEvent.ms_race_id,
            dbRace: matchedDbEvent.race || null,
            dbEventNumb: matchedDbEvent.event_numb,
            status: 'matched'
          }
        } else {
          // No match found - will need manual mapping
          return {
            eventId: event.eventId,
            eventNumber: event.eventNumber,  // Keep file event number temporarily
            fileEvent: {
              distance: event.distance,
              stroke: event.stroke,
              gender: normalizeGender(event.gender),
              relayCount: event.relayCount
            },
            dbRaceId: null,
            dbRace: null,
            dbEventNumb: null,
            status: 'unmatched'
          }
        }
      })
      
      setEventMappings(mappings)
      setDatabaseEvents(dbEvents)
    }
    
    setAvailableRaces(races)
    setCurrentStep('mapEvents')
  }

  async function handleProceedFromEventMapping() {
    if (!previewData) return
    
    // Check which athletes exist in database
    const fincodes = previewData.athletes.map(a => a.fincode)
    const { data: existingAthletes } = await supabase
      .from('athletes')
      .select('fincode, firstname, lastname, gender, birthdate')
      .in('fincode', fincodes)
    
    const athleteMappings: AthleteMapping[] = previewData.athletes.map(athlete => {
      const existing = existingAthletes?.find(a => a.fincode === athlete.fincode)
      
      let status: 'matched' | 'new' | 'conflict' = 'new'
      if (existing) {
        const nameMatch = existing.firstname === athlete.firstname && existing.lastname === athlete.lastname
        status = nameMatch ? 'matched' : 'conflict'
      }
      
      return {
        fincode: athlete.fincode,
        fileAthlete: {
          firstname: athlete.firstname,
          lastname: athlete.lastname,
          gender: athlete.gender,
          birthdate: athlete.birthdate
        },
        dbAthlete: existing ? {
          firstname: existing.firstname,
          lastname: existing.lastname,
          gender: existing.gender,
          birthdate: existing.birthdate
        } : null,
        status
      }
    })
    
    setAthleteMappings(athleteMappings)
    setCurrentStep('mapAthletes')
  }

  async function handleImport() {
    if (!xmlDoc || !previewData || !eventMappings.length || !athleteMappings.length) return
    
    // Check if all events are mapped
    const unmappedEvents = eventMappings.filter(e => !e.dbRaceId)
    if (unmappedEvents.length > 0) {
      alert(`Please map all events before importing. ${unmappedEvents.length} events are unmapped.`)
      return
    }

    setCurrentStep('import')
    setResult(null)

    try {
      const meet = xmlDoc.querySelector('MEET')
      if (!meet) throw new Error('No MEET element found')

      let meetId: number

      if (createNewMeet) {
        // Create new meet
        const meetName = meet.getAttribute('name') || 'Unnamed Meet'
        const meetCity = meet.getAttribute('city') || ''
        const meetNation = meet.getAttribute('nation') || ''
        const meetCourse = meet.getAttribute('course') === 'SCM' ? 2 : 1
        
        const session = meet.querySelector('SESSION')
        const meetDate = session?.getAttribute('date') || new Date().toISOString().split('T')[0]

        const pool = meet.querySelector('POOL')
        const poolName = pool?.getAttribute('name') || ''

        const { data: insertData, error: insertError } = await supabase
          .from('meets')
          .insert({
            meet_name: meetName,
            place: meetCity,
            nation: meetNation,
            meet_course: meetCourse,
            min_date: meetDate,
            max_date: meetDate,
            pool_name: poolName
          })
          .select()
          .single()

        if (insertError) throw insertError
        meetId = insertData.meet_id
      } else {
        if (!selectedMeetId) throw new Error('No meet selected')
        meetId = selectedMeetId
      }

      // Insert/update events using mappings
      for (const mapping of eventMappings) {
        // Check if event already exists
        const { data: existingEvent } = await supabase
          .from('events')
          .select('ms_id')
          .eq('meet_id', meetId)
          .eq('event_numb', mapping.eventNumber)
          .single()
        
        if (existingEvent) {
          // Update existing event
          const { error: updateError } = await supabase
            .from('events')
            .update({
              ms_race_id: mapping.dbRaceId!,
              gender: mapping.fileEvent.gender,
              ms_group_id: null
            })
            .eq('ms_id', existingEvent.ms_id)
          
          if (updateError) {
            throw new Error(`Failed to update event ${mapping.eventNumber}: ${updateError.message}`)
          }
        } else {
          // Insert new event
          const { error: insertError } = await supabase
            .from('events')
            .insert({
              meet_id: meetId,
              event_numb: mapping.eventNumber,
              ms_race_id: mapping.dbRaceId!,
              gender: mapping.fileEvent.gender,
              ms_group_id: null
            })
          
          if (insertError) {
            throw new Error(`Failed to insert event ${mapping.eventNumber}: ${insertError.message}`)
          }
        }
      }

      // Process athletes using mappings
      let athletesImported = 0
      let resultsImported = 0
      let splitsImported = 0
      const errors: string[] = []

      for (const athleteMapping of athleteMappings) {
        try {
          await supabase
            .from('athletes')
            .upsert({
              fincode: athleteMapping.fincode,
              firstname: athleteMapping.fileAthlete.firstname,
              lastname: athleteMapping.fileAthlete.lastname,
              gender: athleteMapping.fileAthlete.gender,
              birthdate: athleteMapping.fileAthlete.birthdate
            }, {
              onConflict: 'fincode',
              ignoreDuplicates: false
            })

          athletesImported++
        } catch (err) {
          errors.push(`Failed to import athlete ${athleteMapping.fincode}: ${err}`)
          continue
        }
      }

      // Build athlete ID to fincode mapping for relay processing
      const athleteIdToFincodeMap = new Map<string, number>()
      const clubsForMapping = Array.from(meet.querySelectorAll('CLUB'))
      for (const club of clubsForMapping) {
        const athletesInClub = Array.from(club.querySelectorAll('ATHLETE'))
        for (const athlete of athletesInClub) {
          const athleteId = athlete.getAttribute('athleteid') || ''
          const fincode = parseInt(athlete.getAttribute('license') || '0')
          if (athleteId && fincode) {
            athleteIdToFincodeMap.set(athleteId, fincode)
          }
        }
      }

      // Process results
      const clubs = Array.from(meet.querySelectorAll('CLUB'))

      for (const club of clubs) {
        const athletes = Array.from(club.querySelectorAll('ATHLETE'))

        for (const athlete of athletes) {
          const fincode = parseInt(athlete.getAttribute('license') || '0')
          if (!fincode) continue

          const results = Array.from(athlete.querySelectorAll('RESULT'))

          for (const result of results) {
            const eventId = result.getAttribute('eventid') || ''
            const swimtime = result.getAttribute('swimtime') || ''

            // Get event mapping
            const eventMapping = eventMappings.find(e => e.eventId === eventId)
            if (!eventMapping) {
              errors.push(`Event ${eventId} not found for athlete ${fincode}`)
              continue
            }

            try {
              // Convert time using database function
              const { data: timeData, error: timeError } = await supabase
                .rpc('timestr_to_totaltime', { time_str: swimtime })
              
              if (timeError) {
                throw new Error(`Failed to convert time ${swimtime}: ${timeError.message}`)
              }

              // Insert into results table (individual races only - relays are in RELAYS section)
              const { data: resultData, error: resultError } = await supabase
                .from('results')
                .upsert({
                  fincode,
                    meet_id: meetId,
                    event_numb: eventMapping.eventNumber,
                    res_time_decimal: timeData,
                    result_status: 'FINISHED',
                    entry_time_decimal: 0
                  }, {
                    onConflict: 'fincode,meet_id,event_numb',
                    ignoreDuplicates: false
                  })
                  .select('res_id')
                  .single()

                if (resultError || !resultData) {
                  throw new Error(`Failed to upsert result: ${resultError?.message || 'No data returned'}`)
                }

                resultsImported++

                // Process splits if available (only for individual races)
                const splits = Array.from(result.querySelectorAll('SPLIT'))
                
                if (splits.length > 0) {
                  // Check if splits already exist for this result
                  const { data: existingSplits } = await supabase
                    .from('splits')
                    .select('splits_id, distance, split_time')
                    .eq('splits_res_id', resultData.res_id)

                  // Build a map of new splits from the file
                  const newSplitsMap = new Map<number, number>()
                  for (const split of splits) {
                    const splitDistance = parseInt(split.getAttribute('distance') || '0')
                    const splitTime = split.getAttribute('swimtime') || ''
                    
                    try {
                      const { data: splitTimeData, error: splitTimeError } = await supabase
                        .rpc('timestr_to_totaltime', { time_str: splitTime })
                    
                    if (splitTimeError) {
                      errors.push(`Failed to convert split time ${splitTime} for athlete ${fincode}: ${splitTimeError.message}`)
                      continue
                    }
                    
                    newSplitsMap.set(splitDistance, splitTimeData)
                  } catch (splitErr) {
                    errors.push(`Error converting split time for athlete ${fincode} at ${splitDistance}m: ${splitErr}`)
                  }
                }

                // Check if splits are identical to existing ones
                let splitsIdentical = false
                if (existingSplits && existingSplits.length === newSplitsMap.size) {
                  splitsIdentical = existingSplits.every(existing => {
                    const newTime = newSplitsMap.get(existing.distance)
                    return newTime !== undefined && newTime === existing.split_time
                  })
                }

                if (splitsIdentical) {
                  splitsImported += existingSplits!.length
                } else {
                  // Delete existing splits if they exist and are different
                  if (existingSplits && existingSplits.length > 0) {
                    const { error: deleteError } = await supabase
                      .from('splits')
                      .delete()
                      .eq('splits_res_id', resultData.res_id)
                    
                    if (deleteError) {
                      errors.push(`Failed to delete existing splits for result ${resultData.res_id}: ${deleteError.message}`)
                    }
                  }

                  // Insert new splits
                  for (const [splitDistance, splitTimeData] of newSplitsMap.entries()) {
                    const { error: splitError } = await supabase
                      .from('splits')
                      .insert({
                        splits_res_id: resultData.res_id,
                        distance: splitDistance,
                        split_time: splitTimeData
                      })

                    if (splitError) {
                      errors.push(`Failed to insert split at ${splitDistance}m for result ${resultData.res_id}: ${splitError.message}`)
                    } else {
                      splitsImported++
                    }
                  }
                }
              }
            } catch (err) {
              errors.push(`Failed to import result for athlete ${fincode} event ${eventMapping.eventNumber}: ${err}`)
            }
          }
        }
      }

      // Process relay results from RELAYS section
      const relaysSection = meet.querySelector('RELAYS')
      if (relaysSection) {
        const relays = Array.from(relaysSection.querySelectorAll('RELAY'))
        
        for (const relay of relays) {
          const relayId = relay.getAttribute('relayid') || ''
          const relayGender = relay.getAttribute('gender') || ''
          
          // Create relay name from relay ID and gender (e.g., "1-M", "2-F")
          const relayName = `${relayId}-${relayGender}`
          
          const relayResults = Array.from(relay.querySelectorAll('RESULTS > RESULT'))
          
          for (const relayResult of relayResults) {
            const eventId = relayResult.getAttribute('eventid') || ''
            
            // Get event mapping
            const eventMapping = eventMappings.find(e => e.eventId === eventId)
            if (!eventMapping) {
              errors.push(`Event ${eventId} not found for relay ${relayId}`)
              continue
            }
            
            try {
              // Extract splits (cumulative times at each interval)
              const splits = Array.from(relayResult.querySelectorAll('SPLIT'))
              const splitTimes: number[] = []
              
              for (const split of splits) {
                const splitTime = split.getAttribute('swimtime') || ''
                const { data: splitTimeData, error: splitTimeError } = await supabase
                  .rpc('timestr_to_totaltime', { time_str: splitTime })
                
                if (splitTimeError) {
                  throw new Error(`Failed to convert split time ${splitTime}: ${splitTimeError.message}`)
                }
                splitTimes.push(splitTimeData)
              }
              
              // Calculate individual leg times (difference between consecutive splits)
              const leg1Time = splitTimes[0] || 0  // First 50m
              const leg2Time = splitTimes.length > 1 ? splitTimes[1] - splitTimes[0] : 0  // Second 50m
              const leg3Time = splitTimes.length > 2 ? splitTimes[2] - splitTimes[1] : 0  // Third 50m
              const leg4Time = splitTimes.length > 3 ? splitTimes[3] - splitTimes[2] : 0  // Fourth 50m
              
              // Extract athlete IDs from RELAYPOSITIONS
              const relayPositions = Array.from(relayResult.querySelectorAll('RELAYPOSITION'))
              const athleteIds: number[] = []
              
              for (const position of relayPositions) {
                const athleteId = position.getAttribute('athleteid') || ''
                // Map athleteid to fincode using the mapping we built
                const fincode = athleteIdToFincodeMap.get(athleteId) || 0
                athleteIds.push(fincode)
              }
              
              // Ensure we have 4 athletes
              while (athleteIds.length < 4) {
                athleteIds.push(0)
              }
              
              // Insert relay result with individual leg times
              const { data: relayResultData, error: relayResultError } = await supabase
                .from('relay_results')
                .insert({
                  meet_id: meetId,
                  event_numb: eventMapping.eventNumber,
                  relay_name: relayName,
                  leg1_fincode: athleteIds[0],
                  leg1_res_time: leg1Time,
                  leg1_entry_time: 0,
                  leg2_fincode: athleteIds[1],
                  leg2_res_time: leg2Time,
                  leg2_entry_time: 0,
                  leg3_fincode: athleteIds[2],
                  leg3_res_time: leg3Time,
                  leg3_entry_time: 0,
                  leg4_fincode: athleteIds[3],
                  leg4_res_time: leg4Time,
                  leg4_entry_time: 0,
                  result_status: 'FINISHED'
                })
                .select('relay_result_id')
                .single()
              
              if (relayResultError) {
                throw new Error(`Failed to upsert relay result: ${relayResultError.message}`)
              }
              
              if (!relayResultData) {
                throw new Error('Failed to upsert relay result: No data returned')
              }
              
              resultsImported++
              
            } catch (err) {
              errors.push(`Failed to import relay result for relay ${relayId} event ${eventMapping.eventNumber}: ${err}`)
            }
          }
        }
      }

      setResult({
        success: true,
        message: 'Import completed successfully!',
        details: {
          athletesImported,
          resultsImported,
          splitsImported,
          errors
        }
      })

      setCurrentStep('complete')

    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      })
      setCurrentStep('complete')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Upload className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Import Lenex File</h1>
        </div>
        <p className="text-muted-foreground">
          Upload and import meet results from Lenex XML files
        </p>
      </div>

      {/* Wizard Steps Indicator */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'upload' ? 'text-primary font-semibold' : ['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'upload' ? 'border-primary bg-primary/10' : ['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '1'}
              </div>
              <span className="hidden sm:inline">Upload</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'preview' ? 'text-primary font-semibold' : ['selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'preview' ? 'border-primary bg-primary/10' : ['selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '2'}
              </div>
              <span className="hidden sm:inline">Preview</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'selectMeet' ? 'text-primary font-semibold' : ['mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'selectMeet' ? 'border-primary bg-primary/10' : ['mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '3'}
              </div>
              <span className="hidden sm:inline">Select Meet</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'mapEvents' ? 'text-primary font-semibold' : ['mapAthletes', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'mapEvents' ? 'border-primary bg-primary/10' : ['mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '4'}
              </div>
              <span className="hidden sm:inline">Map Events</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'mapAthletes' ? 'text-primary font-semibold' : ['import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'mapAthletes' ? 'border-primary bg-primary/10' : ['import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '5'}
              </div>
              <span className="hidden sm:inline">Map Athletes</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'import' ? 'text-primary font-semibold' : currentStep === 'complete' ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'import' ? 'border-primary bg-primary/10' : currentStep === 'complete' ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {currentStep === 'complete' ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '6'}
              </div>
              <span className="hidden sm:inline">Import</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'complete' ? 'text-green-500 font-semibold' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'complete' ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {currentStep === 'complete' ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '7'}
              </div>
              <span className="hidden sm:inline">Complete</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Upload */}
      {currentStep === 'upload' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Select Lenex File</CardTitle>
            <CardDescription>
              Choose a normalized Lenex XML file (.lef or .xml) to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".lef,.xml"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : 'Click to select a file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lenex XML files (.lef, .xml)
                  </p>
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="flex gap-2">
                <Button onClick={handleParseFile} className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview File
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {currentStep === 'preview' && previewData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Meet Information</CardTitle>
              <CardDescription>Review the meet details before importing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Meet Name:</span>
                  <p className="text-muted-foreground">{previewData.meet.meetName}</p>
                </div>
                <div>
                  <span className="font-semibold">Date:</span>
                  <p className="text-muted-foreground">{previewData.meet.date}</p>
                </div>
                <div>
                  <span className="font-semibold">Location:</span>
                  <p className="text-muted-foreground">{previewData.meet.city}, {previewData.meet.nation}</p>
                </div>
                <div>
                  <span className="font-semibold">Course:</span>
                  <p className="text-muted-foreground">{previewData.meet.course}</p>
                </div>
                <div>
                  <span className="font-semibold">Pool:</span>
                  <p className="text-muted-foreground">{previewData.meet.poolName || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Events ({previewData.events.length})</CardTitle>
                <CardDescription>Individual and relay events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {previewData.events.map((event, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted/50 rounded">
                      Event #{event.eventNumber}: {event.relayCount === 4 ? '4x' : ''}{event.distance}m {event.stroke} ({event.gender})
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Athletes ({previewData.athletes.length})</CardTitle>
                <CardDescription>{previewData.totalResults} total results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {previewData.athletes.map((athlete, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted/50 rounded flex justify-between">
                      <span>{athlete.firstname} {athlete.lastname} ({athlete.fincode})</span>
                      <span className="text-muted-foreground">{athlete.resultsCount} results</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentStep('upload')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleProceedFromPreview} className="flex-1">
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Select Meet */}
      {currentStep === 'selectMeet' && (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Select Meet</CardTitle>
            <CardDescription>
              Choose whether to import to an existing meet or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="createNew"
                  checked={createNewMeet}
                  onChange={() => {
                    setCreateNewMeet(true)
                    setSelectedMeetId(null)
                  }}
                />
                <label htmlFor="createNew" className="font-semibold cursor-pointer">
                  Create New Meet
                </label>
              </div>

              {previewData && createNewMeet && (
                <div className="ml-6 p-4 bg-muted/50 rounded space-y-2 text-sm">
                  <p><span className="font-semibold">Name:</span> {previewData.meet.meetName}</p>
                  <p><span className="font-semibold">Date:</span> {previewData.meet.date}</p>
                  <p><span className="font-semibold">Location:</span> {previewData.meet.city}, {previewData.meet.nation}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="selectExisting"
                  checked={!createNewMeet}
                  onChange={() => setCreateNewMeet(false)}
                />
                <label htmlFor="selectExisting" className="font-semibold cursor-pointer">
                  Select Existing Meet
                </label>
              </div>

              {!createNewMeet && (
                <div className="ml-6 space-y-2">
                  <Select
                    value={selectedMeetId?.toString() || ''}
                    onValueChange={(value) => setSelectedMeetId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a meet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMeets.map(meet => (
                        <SelectItem key={meet.meet_id} value={meet.meet_id.toString()}>
                          {meet.meet_name} - {meet.min_date} ({meet.place})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep('preview')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleProceedFromMeetSelection}
                disabled={!createNewMeet && !selectedMeetId}
                className="flex-1"
              >
                Continue to Event Mapping
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Map Events */}
      {currentStep === 'mapEvents' && (
        <Card className="max-w-6xl">
          <CardHeader>
            <CardTitle>Map Events</CardTitle>
            <CardDescription>
              Match events from the file with database races. Auto-matched events are shown in green.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {eventMappings.map((mapping, idx) => (
                <div key={mapping.eventId} className={`p-3 rounded border ${mapping.status === 'matched' ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold">Event #{mapping.eventNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {mapping.fileEvent.relayCount === 4 ? '4x' : ''}{mapping.fileEvent.distance}m {mapping.fileEvent.stroke} ({mapping.fileEvent.gender})
                      </div>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={mapping.dbRaceId?.toString() || ''}
                        onValueChange={(value) => {
                          const raceId = parseInt(value)
                          const race = availableRaces.find(r => r.race_id === raceId)
                          
                          setEventMappings(prev => prev.map((m, i) => {
                            if (i !== idx) return m
                            
                            // For existing meets, find the database event that matches the race and gender
                            if (!createNewMeet && databaseEvents.length > 0) {
                              const matchedDbEvent = databaseEvents.find(dbE => 
                                dbE.ms_race_id === raceId && dbE.gender === m.fileEvent.gender
                              )
                              
                              if (matchedDbEvent) {
                                return {
                                  ...m,
                                  eventNumber: matchedDbEvent.event_numb,  // Use DB event number
                                  dbRaceId: raceId,
                                  dbRace: race || null,
                                  dbEventNumb: matchedDbEvent.event_numb,
                                  status: 'matched'
                                }
                              }
                            }
                            
                            // For new meets or if no matching DB event found
                            return { ...m, dbRaceId: raceId, dbRace: race || null, dbEventNumb: null, status: 'matched' }
                          }))
                        }}
                      >
                        <SelectTrigger className={mapping.status === 'unmatched' ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select database race..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRaces.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No races available</div>
                          ) : (
                            <>
                              {/* Show matching distance and relay type races first */}
                              {availableRaces
                                .filter(r => r.distance === mapping.fileEvent.distance && r.relay_count === mapping.fileEvent.relayCount)
                                .map(race => (
                                  <SelectItem key={race.race_id} value={race.race_id.toString()}>
                                    {race.relay_count === 4 ? '4x' : ''}{race.distance}m {race.stroke_long_en}
                                  </SelectItem>
                                ))}
                              {/* Show other races with same relay type */}
                              {availableRaces
                                .filter(r => !(r.distance === mapping.fileEvent.distance && r.relay_count === mapping.fileEvent.relayCount) && r.relay_count === mapping.fileEvent.relayCount)
                                .map(race => (
                                  <SelectItem key={race.race_id} value={race.race_id.toString()}>
                                    {race.relay_count === 4 ? '4x' : ''}{race.distance}m {race.stroke_long_en}
                                  </SelectItem>
                                ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-8">
                      {mapping.status === 'matched' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep('selectMeet')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleProceedFromEventMapping}
                disabled={eventMappings.some(m => !m.dbRaceId)}
                className="flex-1"
              >
                Continue to Athlete Mapping
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Map Athletes */}
      {currentStep === 'mapAthletes' && (
        <Card className="max-w-6xl">
          <CardHeader>
            <CardTitle>Map Athletes</CardTitle>
            <CardDescription>
              Review athlete matches. Green = matched, Blue = new, Yellow = conflict.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1 text-sm mb-4">
              <div className="flex gap-4">
                <span className="text-green-600">● Matched: {athleteMappings.filter(a => a.status === 'matched').length}</span>
                <span className="text-blue-600">● New: {athleteMappings.filter(a => a.status === 'new').length}</span>
                <span className="text-yellow-600">● Conflicts: {athleteMappings.filter(a => a.status === 'conflict').length}</span>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {athleteMappings.map((mapping) => (
                <div key={mapping.fincode} className={`p-3 rounded border ${
                  mapping.status === 'matched' ? 'border-green-500 bg-green-50' : 
                  mapping.status === 'new' ? 'border-blue-500 bg-blue-50' : 
                  'border-yellow-500 bg-yellow-50'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold">FIN: {mapping.fincode}</div>
                      <div className="text-sm">
                        File: {mapping.fileAthlete.firstname} {mapping.fileAthlete.lastname} ({mapping.fileAthlete.birthdate})
                      </div>
                      {mapping.dbAthlete && (
                        <div className="text-sm text-muted-foreground">
                          DB: {mapping.dbAthlete.firstname} {mapping.dbAthlete.lastname} ({mapping.dbAthlete.birthdate})
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-semibold">
                      {mapping.status === 'matched' && <span className="text-green-600">Matched</span>}
                      {mapping.status === 'new' && <span className="text-blue-600">New</span>}
                      {mapping.status === 'conflict' && <span className="text-yellow-600">Conflict</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep('mapEvents')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleImport} className="flex-1">
                Start Import
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Importing */}
      {currentStep === 'import' && (
        <Card className="max-w-2xl">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-lg font-semibold">Importing data...</p>
              <p className="text-sm text-muted-foreground mt-2">Please wait while we process your file</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Complete */}
      {currentStep === 'complete' && result && (
        <Card className={`max-w-2xl ${result.success ? 'border-green-500' : 'border-red-500'}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <CardTitle className={result.success ? 'text-green-500' : 'text-red-500'}>
                {result.success ? 'Import Successful' : 'Import Failed'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{result.message}</p>
            {result.details && (
              <div className="space-y-2 text-sm">
                <p>✓ Athletes imported: {result.details.athletesImported}</p>
                <p>✓ Results imported: {result.details.resultsImported}</p>
                {result.details.splitsImported !== undefined && (
                  <p>✓ Splits imported: {result.details.splitsImported}</p>
                )}
                {result.details.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Errors ({result.details.errors.length}):</p>
                    <div className="max-h-40 overflow-y-auto bg-muted p-2 rounded text-xs">
                      {result.details.errors.map((error, idx) => (
                        <p key={idx} className="text-red-500">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button 
              onClick={() => {
                setCurrentStep('upload')
                setSelectedFile(null)
                setPreviewData(null)
                setResult(null)
                setXmlDoc(null)
                setSelectedMeetId(null)
                setCreateNewMeet(false)
                setEventMappings([])
                setAthleteMappings([])
              }} 
              className="w-full mt-6"
            >
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
