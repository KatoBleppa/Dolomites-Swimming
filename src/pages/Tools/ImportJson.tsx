import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, XCircle, Eye, ChevronRight, AlertCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ImportResult {
  success: boolean
  message: string
  details?: {
    athletesImported: number
    resultsImported: number
    errors: string[]
  }
}

interface PreviewData {
  meet: {
    name: string
    location: string
    date: string
    pool: string
    course: string
  }
  events: Array<{
    event_number: number
    distance: number | string
    stroke: string
    gender: string
    category: string
    resultsCount: number
  }>
  athletes: Array<{
    fincode: number
    name: string
    firstname: string
    lastname: string
    gender: string
    birthdate: string
    club: string
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
  stroke_long_it: string
}

interface DatabaseEvent {
  event_numb: number
  ms_race_id: number
  gender: string
  ms_group_id: number | null
  race?: DatabaseRace
}

interface EventMapping {
  eventNumber: number
  fileEvent: {
    distance: number | string
    stroke: string
    gender: string
    category: string
  }
  dbRaceId: number | null
  dbRace: DatabaseRace | null
  dbEventNumb: number | null
  dbGroupId: number | null
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
  useFileData?: boolean // For conflicts: true = use file data, false = use db data
}

interface RelayMapping {
  eventNumber: number
  resultIndex: number
  relayName: string
  legs: Array<{
    name: string
    fincode: number
    dbAthlete: {
      firstname: string
      lastname: string
    } | null
    time: string
  }>
  totalTime: string
  status: number
}

type WizardStep = 'upload' | 'preview' | 'selectMeet' | 'mapEvents' | 'mapAthletes' | 'mapRelays' | 'import' | 'complete'

export function ImportJson() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [jsonData, setJsonData] = useState<any>(null)
  
  // State for meet selection and mapping
  const [availableMeets, setAvailableMeets] = useState<DatabaseMeet[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(null)
  const [createNewMeet, setCreateNewMeet] = useState(false)
  const [eventMappings, setEventMappings] = useState<EventMapping[]>([])
  const [athleteMappings, setAthleteMappings] = useState<AthleteMapping[]>([])
  const [relayMappings, setRelayMappings] = useState<RelayMapping[]>([])
  const [availableRaces, setAvailableRaces] = useState<DatabaseRace[]>([])
  const [databaseEvents, setDatabaseEvents] = useState<DatabaseEvent[]>([])

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setResult(null)
      setPreviewData(null)
      setCurrentStep('upload')
      setJsonData(null)
    }
  }

  async function handleParseFile() {
    if (!selectedFile) return

    try {
      const text = await selectedFile.text()
      const data = JSON.parse(text)
      
      if (!data.meet || !data.events) {
        throw new Error('Invalid JSON structure. Expected meet and events properties.')
      }

      setJsonData(data)

      // Helper function to parse name into firstname and lastname
      const parseName = (fullName: string): { firstname: string, lastname: string } => {
        const parts = fullName.trim().split(/\s+/)
        if (parts.length === 1) {
          return { firstname: parts[0], lastname: '' }
        }
        // Last part is lastname, rest is firstname
        const lastname = parts[parts.length - 1]
        const firstname = parts.slice(0, -1).join(' ')
        return { firstname, lastname }
      }

      // Helper function to convert year_of_birth to birthdate
      const yearToBirthdate = (year: number): string => {
        return `${year}-01-01`
      }

      // Extract preview data
      const athletesMap = new Map<number, any>()
      let totalResults = 0
      let totalResultsFromBolzano = 0

      const eventsList = data.events.map((event: any) => {
        const resultsCount = event.results?.length || 0
        let bolzanoResults = 0
        
        // Collect unique athletes from Bolzano Nuoto only
        event.results?.forEach((result: any) => {
          // Only import athletes from Bolzano Nuoto
          if (result.club !== 'Bolzano Nuoto') {
            return
          }
          
          bolzanoResults++
          
          if (!result.name) {
            console.warn('Result without name:', result)
            return
          }
          
          // Use name as the unique key
          const nameKey = result.name.trim()
          
          if (!athletesMap.has(nameKey)) {
            const { firstname, lastname } = parseName(result.name)
            athletesMap.set(nameKey, {
              fincode: 0, // Will be assigned later from DB or generated
              name: result.name,
              firstname,
              lastname,
              gender: result.gender || 'M',
              birthdate: result.year_of_birth ? yearToBirthdate(result.year_of_birth) : '2000-01-01',
              club: result.club,
              resultsCount: 1
            })
          } else {
            // Increment results count for this athlete
            const athlete = athletesMap.get(nameKey)
            athlete.resultsCount++
          }
        })

        totalResults += resultsCount
        totalResultsFromBolzano += bolzanoResults

        return {
          event_number: event.event_number,
          distance: event.distance,
          stroke: event.stroke,
          gender: event.gender,
          category: event.category,
          resultsCount: bolzanoResults // Show only Bolzano results count
        }
      })

      setPreviewData({
        meet: {
          name: data.meet.name,
          location: data.meet.location,
          date: data.meet.date,
          pool: data.meet.pool,
          course: data.meet.course
        },
        events: eventsList,
        athletes: Array.from(athletesMap.values()),
        totalResults: totalResultsFromBolzano
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
      m.meet_name === previewData.meet.name && 
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
      // Map Italian/German variations to English
      if (normalized.includes('libero') || normalized.includes('freistil')) {
        return 'freestyle'
      }
      if (normalized.includes('rana') || normalized.includes('brust')) {
        return 'breaststroke'
      }
      if (normalized.includes('dorso') || normalized.includes('rücken')) {
        return 'backstroke'
      }
      if (normalized.includes('farfalla') || normalized.includes('schmetterling')) {
        return 'butterfly'
      }
      if (normalized.includes('misti') || normalized.includes('lagen')) {
        return 'medley'
      }
      return normalized
    }
    
    // Helper function to normalize gender codes
    const normalizeGender = (gender: string): string => {
      const normalized = gender.toUpperCase().trim()
      if (normalized === 'F') {
        return 'W'  // Female -> Women
      }
      return normalized  // M stays as M
    }
    
    // Load groups for category matching
    const { data: groups } = await supabase
      .from('_groups')
      .select('group_id, group_name')
    
    const groupMap = new Map((groups || []).map(g => [g.group_name, g.group_id]))
    
    if (createNewMeet) {
      // Load all available races for new meet (both individual and relay)
      const { data: allRaces } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count, stroke_long_it')
        .order('race_id')
      
      races = allRaces || []
      
      // For new meets, auto-match events based on distance, stroke, and category
      const mappings: EventMapping[] = previewData.events.map(event => {
        // Get the actual event data from jsonData to check is_relay flag
        const eventData = jsonData.events.find((e: any) => e.event_number === event.event_number)
        const isRelay = eventData?.is_relay === true
        
        let matchedRace
        if (isRelay) {
          // For relay events, parse the distance (e.g., "4x50" -> relay_count=4, distance=50)
          const relayParts = event.distance.toString().split('x')
          const relayCount = parseInt(relayParts[0])
          const relayDistance = parseInt(relayParts[1])
          
          matchedRace = races.find(r => 
            r.distance === relayDistance &&
            r.relay_count === relayCount &&
            r.stroke_short_en === event.stroke
          )
        } else {
          // For individual events
          matchedRace = races.find(r => 
            r.distance === event.distance &&
            r.relay_count === 1 &&
            r.stroke_short_en === event.stroke
          )
        }
        
        // Get group_id from category
        const groupId = groupMap.get(event.category) || null
        
        return {
          eventNumber: event.event_number,
          fileEvent: {
            distance: event.distance,
            stroke: event.stroke,
            gender: normalizeGender(event.gender),
            category: event.category
          },
          dbRaceId: matchedRace?.race_id || null,
          dbRace: matchedRace || null,
          dbEventNumb: null,
          dbGroupId: groupId,
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
          gender,
          ms_group_id
        `)
        .eq('meet_id', selectedMeetId)
        .order('event_numb')
      
      if (meetEventsData && meetEventsData.length > 0) {
        // Fetch race details for these events
        const raceIds = [...new Set(meetEventsData.map(e => e.ms_race_id))]
        const { data: racesData } = await supabase
          .from('_races')
          .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count, stroke_long_it')
          .in('race_id', raceIds)
        
        const raceMap = new Map((racesData || []).map(r => [r.race_id, r]))
        
        dbEvents = meetEventsData.map(e => ({
          event_numb: e.event_numb,
          ms_race_id: e.ms_race_id,
          gender: e.gender,
          ms_group_id: e.ms_group_id,
          race: raceMap.get(e.ms_race_id)
        }))
        
        races = racesData || []
      }
      
      // Also load all races as fallback options for manual mapping (both individual and relay)
      const { data: allRaces } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en, stroke_long_en, relay_count, stroke_long_it')
        .order('race_id')
      
      // Combine races (remove duplicates)
      const existingRaceIds = new Set(races.map(r => r.race_id))
      const additionalRaces = (allRaces || []).filter(r => !existingRaceIds.has(r.race_id))
      races = [...races, ...additionalRaces]
      
      // Auto-match file events to database events based on event_numb matching event_number
      const mappings: EventMapping[] = previewData.events.map(event => {
        // Get group_id from category
        const groupId = groupMap.get(event.category) || null
        
        // Match database event by event_numb == event_number
        const matchedDbEvent = dbEvents.find(dbE => dbE.event_numb === event.event_number)
        
        if (matchedDbEvent && matchedDbEvent.race) {
          // Event exists in database - use database event data
          return {
            eventNumber: matchedDbEvent.event_numb,
            fileEvent: {
              distance: event.distance,
              stroke: event.stroke,
              gender: normalizeGender(event.gender),
              category: event.category
            },
            dbRaceId: matchedDbEvent.ms_race_id,
            dbRace: matchedDbEvent.race,
            dbEventNumb: matchedDbEvent.event_numb,
            dbGroupId: matchedDbEvent.ms_group_id,
            status: 'matched'
          }
        } else {
          // Event not in database - try to find matching race for manual mapping
          const eventData = jsonData.events.find((e: any) => e.event_number === event.event_number)
          const isRelay = eventData?.is_relay === true
          
          let matchedRace: DatabaseRace | undefined
          
          if (isRelay) {
            // Parse relay distance (e.g., "4x50" -> relay_count=4, distance=50)
            const relayParts = event.distance.toString().split('x')
            const relayCount = parseInt(relayParts[0])
            const eventDistance = parseInt(relayParts[1])
            
            matchedRace = races.find(r => 
              r.distance === eventDistance &&
              r.relay_count === relayCount &&
              r.stroke_short_en === event.stroke
            )
          } else {
            // For individual events
            matchedRace = races.find(r => 
              r.distance === event.distance &&
              r.relay_count === 1 &&
              r.stroke_short_en === event.stroke
            )
          }
          
          return {
            eventNumber: event.event_number,
            fileEvent: {
              distance: event.distance,
              stroke: event.stroke,
              gender: normalizeGender(event.gender),
              category: event.category
            },
            dbRaceId: matchedRace?.race_id || null,
            dbRace: matchedRace || null,
            dbEventNumb: null,
            dbGroupId: groupId,
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
    
    // Get all athletes from database to match by name
    const { data: allAthletes } = await supabase
      .from('athletes')
      .select('fincode, firstname, lastname, gender, birthdate')
    
    const athleteMappings: AthleteMapping[] = previewData.athletes.map(athlete => {
      // Try to find matching athlete by checking if db firstname and lastname are contained in the full name
      const fileNameLower = athlete.name.toLowerCase()
      let existing = allAthletes?.find(a => 
        fileNameLower.includes(a.firstname.toLowerCase()) && 
        fileNameLower.includes(a.lastname.toLowerCase())
      )
      
      // If not found by name, try matching by parsed firstname and lastname
      if (!existing) {
        existing = allAthletes?.find(a =>
          a.firstname.toLowerCase() === athlete.firstname.toLowerCase() &&
          a.lastname.toLowerCase() === athlete.lastname.toLowerCase()
        )
      }
      
      // Simple matching: if found in DB use it, otherwise it's new
      const status: 'matched' | 'new' | 'conflict' = existing ? 'matched' : 'new'
      
      return {
        fincode: existing?.fincode || 0, // Use existing fincode or 0 for new
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
        status,
        useFileData: false // Always use database data when available
      }
    })
    
    setAthleteMappings(athleteMappings)
    setCurrentStep('mapAthletes')
  }

  async function handleProceedFromAthleteMapping() {
    if (!jsonData || !previewData) return
    
    // Check if there are any relay events
    const relayEvents = eventMappings.filter(mapping => mapping.dbRace && mapping.dbRace.relay_count > 1)
    
    if (relayEvents.length === 0) {
      // No relay events, skip to import
      await handleImport()
      return
    }
    
    // Get all athletes from database for matching relay legs
    const { data: allAthletes } = await supabase
      .from('athletes')
      .select('fincode, firstname, lastname')
    
    // Helper function to parse name
    const parseName = (fullName: string): { firstname: string, lastname: string } => {
      const parts = fullName.trim().split(/\s+/)
      if (parts.length === 1) {
        return { firstname: parts[0], lastname: '' }
      }
      const lastname = parts[parts.length - 1]
      const firstname = parts.slice(0, -1).join(' ')
      return { firstname, lastname }
    }
    
    // Collect relay results from JSON data
    const relayMappings: RelayMapping[] = []
    
    for (const event of jsonData.events) {
      const eventMapping = eventMappings.find(e => e.eventNumber === event.event_number)
      if (!eventMapping || !eventMapping.dbRace || eventMapping.dbRace.relay_count <= 1) {
        continue
      }
      
      if (!event.results) continue
      
      event.results.forEach((result: any, index: number) => {
        // Only process Bolzano Nuoto relays
        if (result.club !== 'Bolzano Nuoto') {
          return
        }
        
        // Parse relay legs from athletes array
        const legs: RelayMapping['legs'] = []
        if (result.athletes && Array.isArray(result.athletes)) {
          result.athletes.forEach((athlete: any) => {
            const { firstname, lastname } = parseName(athlete.name || '')
            
            // Try to find matching athlete using same logic as individual athletes
            // First, try by checking if db firstname and lastname are contained in the full name
            const athleteNameLower = (athlete.name || '').toLowerCase()
            let existing = allAthletes?.find(a =>
              athleteNameLower.includes(a.firstname.toLowerCase()) &&
              athleteNameLower.includes(a.lastname.toLowerCase())
            )
            
            // If not found by name, try matching by parsed firstname and lastname
            if (!existing) {
              existing = allAthletes?.find(a =>
                a.firstname.toLowerCase() === firstname.toLowerCase() &&
                a.lastname.toLowerCase() === lastname.toLowerCase()
              )
            }
            
            legs.push({
              name: athlete.name || '',
              fincode: existing?.fincode || 0,
              dbAthlete: existing ? {
                firstname: existing.firstname,
                lastname: existing.lastname
              } : null,
              time: athlete.time || '00:00.00'
            })
          })
        }
        
        // Determine status
        let resultStatus = 4 // Normal
        const timeUpper = result.time?.toUpperCase() || ''
        if (timeUpper === 'DQ') resultStatus = 1
        else if (timeUpper === 'DNF') resultStatus = 2
        else if (timeUpper === 'DNS') resultStatus = 3
        
        relayMappings.push({
          eventNumber: event.event_number,
          resultIndex: index,
          relayName: result.name || `Bolzano Nuoto ${String.fromCharCode(65 + relayMappings.filter(r => r.eventNumber === event.event_number).length)}`,
          legs,
          totalTime: result.time || '00:00.00',
          status: resultStatus
        })
      })
    }
    
    setRelayMappings(relayMappings)
    setCurrentStep('mapRelays')
  }

  async function handleImport() {
    if (!jsonData || !previewData || !eventMappings.length || !athleteMappings.length) return
    
    // Check if all events are mapped
    const unmappedEvents = eventMappings.filter(e => !e.dbRaceId)
    if (unmappedEvents.length > 0) {
      alert(`Please map all events before importing. ${unmappedEvents.length} events are unmapped.`)
      return
    }

    setCurrentStep('import')
    setResult(null)

    try {
      let meetId: number

      if (createNewMeet) {
        // Create new meet
        const meetCourse = previewData.meet.course === '25m' ? 2 : 1

        const { data: insertData, error: insertError } = await supabase
          .from('meets')
          .insert({
            meet_name: previewData.meet.name,
            place: previewData.meet.location,
            nation: '',
            meet_course: meetCourse,
            min_date: previewData.meet.date,
            max_date: previewData.meet.date,
            pool_name: previewData.meet.pool
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
              ms_group_id: mapping.dbGroupId
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
              ms_group_id: mapping.dbGroupId
            })
          
          if (insertError) {
            throw new Error(`Failed to insert event ${mapping.eventNumber}: ${insertError.message}`)
          }
        }
      }

      // Process athletes and results
      let athletesImported = 0
      let resultsImported = 0
      const errors: string[] = []

      // Insert/update athletes using mappings
      for (const athleteMapping of athleteMappings) {
        try {
          if (athleteMapping.fincode === 0) {
            // New athlete without fincode - skip and report warning
            errors.push(`WARNING: Athlete ${athleteMapping.fileAthlete.firstname} ${athleteMapping.fileAthlete.lastname} not found in database. Please add this athlete first with a valid fincode.`)
            continue
          }
          
          // Always use database data when athlete is matched
          const dataToUse = athleteMapping.dbAthlete || athleteMapping.fileAthlete
          
          await supabase
            .from('athletes')
            .upsert({
              fincode: athleteMapping.fincode,
              firstname: dataToUse.firstname,
              lastname: dataToUse.lastname,
              gender: dataToUse.gender,
              birthdate: dataToUse.birthdate
            }, {
              onConflict: 'fincode',
              ignoreDuplicates: false
            })

          athletesImported++
        } catch (err) {
          errors.push(`Failed to import athlete ${athleteMapping.fileAthlete.firstname} ${athleteMapping.fileAthlete.lastname}: ${err}`)
          continue
        }
      }

      // Process results
      // Helper function to parse name (same as in handleParseFile)
      const parseName = (fullName: string): { firstname: string, lastname: string } => {
        const parts = fullName.trim().split(/\s+/)
        if (parts.length === 1) {
          return { firstname: parts[0], lastname: '' }
        }
        const lastname = parts[parts.length - 1]
        const firstname = parts.slice(0, -1).join(' ')
        return { firstname, lastname }
      }
      
      for (const event of jsonData.events) {
        if (!event.results) continue

        // Get event mapping by matching event_number
        const eventMapping = eventMappings.find(e => e.eventNumber === event.event_number)
        
        if (!eventMapping) {
          errors.push(`Event mapping not found for event ${event.event_number}`)
          continue
        }

        // Check if this is a relay event
        const isRelayEvent = eventMapping.dbRace && eventMapping.dbRace.relay_count > 1

        for (const result of event.results) {
          // Only import results from Bolzano Nuoto
          if (result.club !== 'Bolzano Nuoto') {
            continue
          }
          
          if (!result.time) {
            errors.push(`Skipping result without time`)
            continue
          }

          // Handle relay events differently
          if (isRelayEvent) {
            // Skip relay processing here - will be handled separately below
            continue
          }
          
          if (!result.name) {
            errors.push(`Skipping result without name`)
            continue
          }
          
          // Find athlete by name in mappings
          const { firstname, lastname } = parseName(result.name)
          const athleteMapping = athleteMappings.find(a => 
            a.fileAthlete.firstname.toLowerCase() === firstname.toLowerCase() && 
            a.fileAthlete.lastname.toLowerCase() === lastname.toLowerCase()
          )
          
          if (!athleteMapping || athleteMapping.fincode === 0) {
            errors.push(`Cannot import result for ${result.name}: athlete not found in database or missing fincode`)
            continue
          }
          
          const fincode = athleteMapping.fincode

          try {
            // Determine status and time based on result type
            let timeDecimal: number
            let resultStatus: number
            
            const timeUpper = result.time.toUpperCase()
            
            if (timeUpper === 'DQ') {
              // Disqualification
              const { data: dqTime } = await supabase.rpc('timestr_to_totaltime', { time_str: '00:00.00' })
              timeDecimal = dqTime || 0
              resultStatus = 1
            } else if (timeUpper === 'DNF') {
              // Did Not Finish
              const { data: dnfTime } = await supabase.rpc('timestr_to_totaltime', { time_str: '00:00.00' })
              timeDecimal = dnfTime || 0
              resultStatus = 2
            } else if (timeUpper === 'DNS') {
              // Did Not Start
              const { data: dnsTime } = await supabase.rpc('timestr_to_totaltime', { time_str: '00:00.00' })
              timeDecimal = dnsTime || 0
              resultStatus = 3
            } else {
              // Normal finished time
              const { data: timeData, error: timeError } = await supabase
                .rpc('timestr_to_totaltime', { time_str: result.time })
              
              if (timeError) {
                throw new Error(`Failed to convert time ${result.time}: ${timeError.message}`)
              }
              
              timeDecimal = timeData || 0
              resultStatus = 4
            }

            // Insert into results table and get the res_id
            const { data: resultData, error: resultError } = await supabase
              .from('results')
              .upsert({
                fincode: fincode,
                meet_id: meetId,
                event_numb: eventMapping.eventNumber,
                res_time_decimal: timeDecimal,
                status: resultStatus,
                entry_time_decimal: 0
              }, {
                onConflict: 'fincode,meet_id,event_numb',
                ignoreDuplicates: false
              })
              .select('res_id')
              .single()

            if (resultError) {
              throw new Error(`Failed to upsert result: ${resultError.message}`)
            }

            const resId = resultData?.res_id

            // Process splits if they exist
            if (result.splits && Array.isArray(result.splits) && result.splits.length > 0 && resId) {
              // First, delete any existing splits for this result to avoid conflicts
              const { error: deleteError } = await supabase
                .from('splits')
                .delete()
                .eq('splits_res_id', resId)

              if (deleteError) {
                errors.push(`Failed to delete existing splits for ${result.name}: ${deleteError.message}`)
              }

              // Calculate split interval (total distance / number of splits)
              const totalDistance = eventMapping.dbRace?.distance || event.distance
              const splitInterval = totalDistance / result.splits.length

              for (let i = 0; i < result.splits.length; i++) {
                const splitTime = result.splits[i]
                if (!splitTime) continue

                try {
                  // Calculate cumulative distance for this split
                  const splitDistance = Math.round((i + 1) * splitInterval)

                  // Convert split time to milliseconds
                  const { data: splitTimeDecimal, error: splitTimeError } = await supabase
                    .rpc('timestr_to_totaltime', { time_str: splitTime })

                  if (splitTimeError) {
                    errors.push(`Failed to convert split time ${splitTime} for ${result.name}: ${splitTimeError.message}`)
                    continue
                  }

                  // Insert split into database
                  const { error: splitError } = await supabase
                    .from('splits')
                    .insert({
                      splits_res_id: resId,
                      distance: splitDistance,
                      split_time: splitTimeDecimal || 0
                    })

                  if (splitError) {
                    errors.push(`Failed to insert split for ${result.name} at ${splitDistance}m: ${splitError.message}`)
                  }
                } catch (splitErr) {
                  errors.push(`Error processing split ${i + 1} for ${result.name}: ${splitErr}`)
                }
              }
            }

            resultsImported++
          } catch (err) {
            errors.push(`Failed to import result for athlete ${result.fincode} event ${eventMapping.eventNumber}: ${err}`)
          }
        }
      }

      // Process relay results
      let relayResultsImported = 0
      for (const relayMapping of relayMappings) {
        try {
          // Convert leg times
          const legTimes: number[] = []
          for (const leg of relayMapping.legs) {
            const { data: timeData, error: timeError } = await supabase
              .rpc('timestr_to_totaltime', { time_str: leg.time })
            
            if (timeError) {
              throw new Error(`Failed to convert leg time ${leg.time}: ${timeError.message}`)
            }
            legTimes.push(timeData || 0)
          }

          // Build relay result object
          const relayResult: any = {
            meet_id: meetId,
            event_numb: relayMapping.eventNumber,
            relay_name: relayMapping.relayName,
            status: relayMapping.status
          }

          // Add leg fincodes and times (up to 4 legs)
          for (let i = 0; i < 4; i++) {
            if (i < relayMapping.legs.length) {
              relayResult[`leg${i + 1}_fincode`] = relayMapping.legs[i].fincode || null
              relayResult[`leg${i + 1}_res_time`] = legTimes[i]
              relayResult[`leg${i + 1}_entry_time`] = 0
            } else {
              relayResult[`leg${i + 1}_fincode`] = null
              relayResult[`leg${i + 1}_res_time`] = null
              relayResult[`leg${i + 1}_entry_time`] = null
            }
          }

          // Insert relay result
          const { error: relayError } = await supabase
            .from('relay_results')
            .insert(relayResult)

          if (relayError) {
            throw new Error(`Failed to insert relay result: ${relayError.message}`)
          }

          relayResultsImported++
        } catch (err) {
          errors.push(`Failed to import relay for event ${relayMapping.eventNumber}: ${err}`)
        }
      }

      setResult({
        success: true,
        message: 'Import completed successfully!',
        details: {
          athletesImported,
          resultsImported: resultsImported + relayResultsImported,
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
          <h1 className="text-4xl font-bold tracking-tight">Import JSON File</h1>
        </div>
        <p className="text-muted-foreground">
          Upload and import meet results from JSON files
        </p>
      </div>

      {/* Wizard Steps Indicator */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'upload' ? 'text-primary font-semibold' : ['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'upload' ? 'border-primary bg-primary/10' : ['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['preview', 'selectMeet', 'mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '1'}
              </div>
              <span className="hidden sm:inline">Upload</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'preview' ? 'text-primary font-semibold' : ['selectMeet', 'mapEvents', 'mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'preview' ? 'border-primary bg-primary/10' : ['selectMeet', 'mapEvents', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['selectMeet', 'mapEvents', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '2'}
              </div>
              <span className="hidden sm:inline">Preview</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'selectMeet' ? 'text-primary font-semibold' : ['mapEvents', 'mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'selectMeet' ? 'border-primary bg-primary/10' : ['mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['mapEvents', 'mapAthletes', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '3'}
              </div>
              <span className="hidden sm:inline">Select Meet</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'mapEvents' ? 'text-primary font-semibold' : ['mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'mapEvents' ? 'border-primary bg-primary/10' : ['mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['mapAthletes', 'mapRelays', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '4'}
              </div>
              <span className="hidden sm:inline">Map Events</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'mapAthletes' ? 'text-primary font-semibold' : ['mapRelays', 'import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'mapAthletes' ? 'border-primary bg-primary/10' : ['mapRelays', 'import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['mapRelays', 'import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '5'}
              </div>
              <span className="hidden sm:inline">Map Athletes</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'mapRelays' ? 'text-primary font-semibold' : ['import', 'complete'].includes(currentStep) ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'mapRelays' ? 'border-primary bg-primary/10' : ['import', 'complete'].includes(currentStep) ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {['import', 'complete'].includes(currentStep) ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '6'}
              </div>
              <span className="hidden sm:inline">Map Relays</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'import' ? 'text-primary font-semibold' : currentStep === 'complete' ? 'text-green-500' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'import' ? 'border-primary bg-primary/10' : currentStep === 'complete' ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {currentStep === 'complete' ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '7'}
              </div>
              <span className="hidden sm:inline">Import</span>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <div className={`flex items-center gap-1 sm:gap-2 ${currentStep === 'complete' ? 'text-green-500 font-semibold' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'complete' ? 'border-green-500 bg-green-500/10' : 'border-muted'}`}>
                {currentStep === 'complete' ? <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5" /> : '8'}
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
            <CardTitle>Select JSON File</CardTitle>
            <CardDescription>
              Choose a JSON file (.json) to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".json"
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
                    JSON files (.json)
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
                  <p className="text-muted-foreground">{previewData.meet.name}</p>
                </div>
                <div>
                  <span className="font-semibold">Date:</span>
                  <p className="text-muted-foreground">{previewData.meet.date}</p>
                </div>
                <div>
                  <span className="font-semibold">Location:</span>
                  <p className="text-muted-foreground">{previewData.meet.location}</p>
                </div>
                <div>
                  <span className="font-semibold">Course:</span>
                  <p className="text-muted-foreground">{previewData.meet.course}</p>
                </div>
                <div>
                  <span className="font-semibold">Pool:</span>
                  <p className="text-muted-foreground">{previewData.meet.pool}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events ({previewData.events.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-auto">
                {previewData.events.map((event, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                    <span>
                      #{event.event_number} - {event.distance}m {event.stroke} ({event.gender}) - {event.category}
                    </span>
                    <span className="text-muted-foreground">{event.resultsCount} results</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Athletes from Bolzano Nuoto ({previewData.athletes.length})</CardTitle>
              <CardDescription>Athletes that will be imported</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-auto">
                {previewData.athletes.map((athlete, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                    <span>
                      {athlete.firstname} {athlete.lastname} ({athlete.gender}) - Born: {athlete.birthdate}
                    </span>
                    <span className="text-muted-foreground">{athlete.resultsCount} results</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Total Athletes (Bolzano Nuoto):</span>
                  <p className="text-muted-foreground">{previewData.athletes.length}</p>
                </div>
                <div>
                  <span className="font-semibold">Total Results (Bolzano Nuoto):</span>
                  <p className="text-muted-foreground">{previewData.totalResults}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentStep('upload')}>
              <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
              Back
            </Button>
            <Button onClick={handleProceedFromPreview} className="flex-1">
              Continue to Meet Selection
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Select Meet */}
      {currentStep === 'selectMeet' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Select Target Meet</CardTitle>
            <CardDescription>
              Choose an existing meet or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="new-meet"
                  checked={createNewMeet}
                  onChange={() => {
                    setCreateNewMeet(true)
                    setSelectedMeetId(null)
                  }}
                  className="h-4 w-4"
                />
                <label htmlFor="new-meet" className="text-sm font-medium">
                  Create new meet
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="existing-meet"
                  checked={!createNewMeet}
                  onChange={() => setCreateNewMeet(false)}
                  className="h-4 w-4"
                />
                <label htmlFor="existing-meet" className="text-sm font-medium">
                  Add to existing meet
                </label>
              </div>

              {!createNewMeet && (
                <Select
                  value={selectedMeetId?.toString() || ''}
                  onValueChange={(value) => setSelectedMeetId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a meet" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMeets.map((meet) => (
                      <SelectItem key={meet.meet_id} value={meet.meet_id.toString()}>
                        {meet.meet_name} - {meet.min_date} ({meet.place})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep('preview')}>
                <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                Back
              </Button>
              <Button 
                onClick={handleProceedFromMeetSelection} 
                className="flex-1"
                disabled={!createNewMeet && !selectedMeetId}
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
        <Card>
          <CardHeader>
            <CardTitle>Map Events to Database Races</CardTitle>
            <CardDescription>
              Verify that events are correctly matched to database races
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {eventMappings.map((mapping, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        Event #{mapping.eventNumber} - {mapping.dbRace ? `${mapping.dbRace.distance}m ${mapping.dbRace.stroke_short_en}` : `${mapping.fileEvent.distance}m ${mapping.fileEvent.stroke}`} ({mapping.fileEvent.gender})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Category: {mapping.fileEvent.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mapping.status === 'matched' ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Matched
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Needs Mapping
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {mapping.dbRace && (
                    <div className="text-sm text-muted-foreground pl-4 border-l-2 border-green-500">
                      Database: {mapping.dbRace.distance}m {mapping.dbRace.stroke_short_en} {mapping.dbRace.relay_count > 1 ? `(${mapping.dbRace.relay_count}x relay)` : ''}
                    </div>
                  )}

                  {!mapping.dbRaceId && (
                    <Select
                      value={mapping.dbRaceId?.toString() || ''}
                      onValueChange={(value) => {
                        const raceId = parseInt(value)
                        const race = availableRaces.find(r => r.race_id === raceId)
                        const newMappings = [...eventMappings]
                        newMappings[index] = {
                          ...mapping,
                          dbRaceId: raceId,
                          dbRace: race || null,
                          status: 'matched'
                        }
                        setEventMappings(newMappings)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a race" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRaces.map((race) => (
                          <SelectItem key={race.race_id} value={race.race_id.toString()}>
                            {race.distance}m {race.stroke_short_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep('selectMeet')}>
                <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                Back
              </Button>
              <Button 
                onClick={handleProceedFromEventMapping} 
                className="flex-1"
                disabled={eventMappings.some(e => !e.dbRaceId)}
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
        <Card>
          <CardHeader>
            <CardTitle>Athlete Mapping</CardTitle>
            <CardDescription>
              Review athlete information and conflicts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {athleteMappings.map((mapping, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        {mapping.fileAthlete.firstname} {mapping.fileAthlete.lastname}
                        {mapping.fincode > 0 && <span className="text-muted-foreground ml-2">(Fincode: {mapping.fincode})</span>}
                        {mapping.fincode === 0 && <span className="text-red-500 ml-2">(No fincode - WILL NOT BE IMPORTED)</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Gender: {mapping.dbAthlete && mapping.dbAthlete.gender ? mapping.dbAthlete.gender : mapping.fileAthlete.gender}, Born: {mapping.dbAthlete && mapping.dbAthlete.birthdate ? mapping.dbAthlete.birthdate : mapping.fileAthlete.birthdate}
                        {mapping.dbAthlete && mapping.dbAthlete.birthdate && <span className="text-xs ml-1">(DB)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mapping.status === 'matched' ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Matched
                        </span>
                      ) : mapping.status === 'new' ? (
                        <span className="flex items-center gap-1 text-blue-600 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          New
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Conflict
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {mapping.dbAthlete && mapping.status === 'conflict' && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded space-y-3">
                      <div className="text-sm font-medium text-amber-800">
                        Data Conflict - Choose which values to use:
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`athlete-conflict-${index}`}
                            checked={mapping.useFileData === true}
                            onChange={() => {
                              const newMappings = [...athleteMappings]
                              newMappings[index].useFileData = true
                              setAthleteMappings(newMappings)
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">Use File Data</div>
                            <div className="text-xs text-muted-foreground">
                              {mapping.fileAthlete.firstname} {mapping.fileAthlete.lastname}, Gender: {mapping.fileAthlete.gender}, Born: {mapping.fileAthlete.birthdate}
                            </div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name={`athlete-conflict-${index}`}
                            checked={mapping.useFileData === false}
                            onChange={() => {
                              const newMappings = [...athleteMappings]
                              newMappings[index].useFileData = false
                              setAthleteMappings(newMappings)
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium">Keep Database Data</div>
                            <div className="text-xs text-muted-foreground">
                              {mapping.dbAthlete.firstname} {mapping.dbAthlete.lastname}, Gender: {mapping.dbAthlete.gender}, Born: {mapping.dbAthlete.birthdate}
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  {mapping.dbAthlete && mapping.status === 'matched' && (
                    <div className="text-sm text-muted-foreground pl-4 border-l-2 border-green-500">
                      Already in database
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep('mapEvents')}>
                <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                Back
              </Button>
              <Button 
                onClick={handleProceedFromAthleteMapping} 
                className="flex-1"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Map Relays */}
      {currentStep === 'mapRelays' && (
        <Card>
          <CardHeader>
            <CardTitle>Relay Results Mapping</CardTitle>
            <CardDescription>
              Review and configure relay team names and swimmers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {relayMappings.map((mapping, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">
                        Event #{mapping.eventNumber} - Relay Result
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Time: {mapping.totalTime}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Team Name</label>
                    <input
                      type="text"
                      value={mapping.relayName}
                      onChange={(e) => {
                        const newMappings = [...relayMappings]
                        newMappings[index].relayName = e.target.value
                        setRelayMappings(newMappings)
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="Enter team name (e.g., Bolzano Nuoto A)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Swimmers ({mapping.legs.length} legs)</div>
                    {mapping.legs.map((leg, legIndex) => (
                      <div key={legIndex} className="pl-4 py-2 border-l-2 border-blue-500 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              Leg {legIndex + 1}: {leg.name}
                              {leg.fincode > 0 && <span className="text-muted-foreground ml-2">(Fincode: {leg.fincode})</span>}
                              {leg.fincode === 0 && <span className="text-red-500 ml-2">(Not in database)</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Time: {leg.time}
                            </div>
                          </div>
                          {leg.dbAthlete ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 text-sm">
                              <AlertCircle className="h-4 w-4" />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep('mapAthletes')}>
                <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                Back
              </Button>
              <Button 
                onClick={handleImport} 
                className="flex-1"
              >
                Start Import
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Import Progress */}
      {currentStep === 'import' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Importing Data...</CardTitle>
            <CardDescription>
              Please wait while the data is being imported
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7: Complete */}
      {currentStep === 'complete' && result && (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <CardTitle>
                  {result.success ? 'Import Completed' : 'Import Failed'}
                </CardTitle>
                <CardDescription>{result.message}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.details && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Athletes Imported</div>
                    <div className="text-2xl font-bold">{result.details.athletesImported}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Results Imported</div>
                    <div className="text-2xl font-bold">{result.details.resultsImported}</div>
                  </div>
                </div>

                {result.details.errors.length > 0 && (
                  <div className="p-4 border border-amber-500 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <span className="font-semibold">Errors ({result.details.errors.length})</span>
                    </div>
                    <div className="max-h-48 overflow-auto space-y-1">
                      {result.details.errors.map((error, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {error}
                        </div>
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
                setJsonData(null)
                setSelectedMeetId(null)
                setCreateNewMeet(false)
                setEventMappings([])
                setAthleteMappings([])
              }}
              className="w-full"
            >
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
