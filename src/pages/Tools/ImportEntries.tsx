import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle, Upload, XCircle, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSeason } from '@/contexts/SeasonContext'

type WizardStep = 'upload' | 'preview' | 'selectMeet' | 'mapEvents' | 'import' | 'complete'

interface ParsedAthlete {
  rawName: string
  firstname: string
  lastname: string
  birthdate: string | null
  gender: string
  fincode?: number
}

interface ParsedEvent {
  key: string
  distance: number
  stroke: string
  gender: string
  category: string
  count: number
}

interface ParsedEntry {
  rowIndex: number
  athleteKey: string
  eventKey: string
  club: string
}

interface PreviewData {
  athletes: ParsedAthlete[]
  events: ParsedEvent[]
  entries: ParsedEntry[]
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
  stroke_long_it: string
  stroke_short_it: string
  relay_count: number
}

interface GroupOption {
  id: number
  name: string
}

interface DatabaseEvent {
  ms_id: number
  event_numb: number
  ms_race_id: number
  gender: string
  ms_group_id: number | null
  race?: DatabaseRace
  group_ids?: number[]
}

interface EventMapping {
  key: string
  fileEvent: {
    distance: number
    stroke: string
    gender: string
    category: string
  }
  dbEventId: number | null
  dbEventNumb: number | null
  dbRaceId: number | null
  dbRace: DatabaseRace | null
  dbGroupId: number | null
  createNew: boolean
}

interface ImportResult {
  success: boolean
  message: string
  details?: {
    entriesProcessed: number
    entriesImported: number
    entriesSkipped: number
    errors: string[]
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeGender(value: string) {
  const normalized = value.toUpperCase().trim()
  if (normalized === 'F') return 'W'
  if (normalized === 'M') return 'M'
  return normalized || 'X'
}

function parseBirthdate(value: string | null) {
  if (!value) return null
  const parts = value.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  if (!day || !month || !year) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAthleteName(raw: string): ParsedAthlete {
  const trimmed = raw.trim()
  const match = trimmed.match(/^([^,]+),\s*([^()]+)\s*(?:\(([^)]+)\))?$/)
  if (match) {
    const lastname = match[1].trim()
    const firstname = match[2].trim()
    const birthdate = parseBirthdate(match[3] ? match[3].trim() : null)
    return {
      rawName: raw,
      firstname,
      lastname,
      birthdate,
      gender: ''
    }
  }

  const parts = trimmed.split(',')
  const lastname = parts[0]?.trim() || ''
  const firstname = parts[1]?.trim() || ''
  return {
    rawName: raw,
    firstname,
    lastname,
    birthdate: null,
    gender: ''
  }
}

function parseEventField(value: string): { distance: number; stroke: string } | null {
  const cleaned = value.trim()
  const match = cleaned.match(/^(\d+)\s+(.+?)(?:\s*\([^)]*\))?$/)
  if (!match) return null
  const distance = Number(match[1])
  const stroke = match[2].trim()
  if (!distance || !stroke) return null
  return { distance, stroke }
}

function mapCategoryToGroupId(category: string): number | null {
  const normalized = normalizeText(category)
  if (['ass', 'assoluti', 'assoluto'].includes(normalized)) return 1
  if (['ea', 'eso a', 'esoa', 'esordienti a', 'esordiente a'].includes(normalized)) return 2
  if (['eb', 'eso b', 'esob', 'esordienti b', 'esordiente b'].includes(normalized)) return 3
  if (['prop', 'propaganda'].includes(normalized)) return 4
  return null
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField)
      if (currentRow.some(field => field.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
      continue
    }

    currentField += char
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

function buildEventKey(event: { distance: number; stroke: string; gender: string; category: string }) {
  return `${event.distance}|${normalizeText(event.stroke)}|${event.gender}|${normalizeText(event.category)}`
}

function matchesStroke(race: DatabaseRace, stroke: string) {
  const normalized = normalizeText(stroke)
  const raceValues = [
    race.stroke_long_it,
    race.stroke_long_en,
    race.stroke_short_en,
    race.stroke_short_it
  ].filter(Boolean)

  if (raceValues.some(value => normalizeText(value) === normalized)) {
    return true
  }

  const aliasMap: Record<string, string[]> = {
    'stile libero': ['fr', 'free', 'freestyle', 'sl'],
    'dorso': ['bk', 'back'],
    'rana': ['br', 'breast'],
    'farfalla': ['fl', 'fly', 'butterfly'],
    'misti': ['im', 'medley']
  }

  const alias = aliasMap[normalized]
  if (!alias) return false

  return raceValues.some(value => alias.includes(normalizeText(value)))
}

export function ImportEntries() {
  const { selectedSeason } = useSeason()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [availableMeets, setAvailableMeets] = useState<DatabaseMeet[]>([])
  const [selectedMeetId, setSelectedMeetId] = useState<number | null>(null)
  const [availableRaces, setAvailableRaces] = useState<DatabaseRace[]>([])
  const [meetEvents, setMeetEvents] = useState<DatabaseEvent[]>([])
  const [eventMappings, setEventMappings] = useState<EventMapping[]>([])
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([])
  const [athleteLookup, setAthleteLookup] = useState<Map<string, number>>(new Map())
  const [athleteNameLookup, setAthleteNameLookup] = useState<Map<string, number>>(new Map())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedMeet = useMemo(
    () => availableMeets.find(meet => meet.meet_id === selectedMeetId) || null,
    [availableMeets, selectedMeetId]
  )

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewData(null)
      setSelectedMeetId(null)
      setEventMappings([])
      setAvailableMeets([])
      setMeetEvents([])
      setAvailableRaces([])
      setResult(null)
      setCurrentStep('upload')
    }
  }

  async function handleParseFile() {
    if (!selectedFile) return
    try {
      const text = await selectedFile.text()
      const rows = parseCsv(text)
      if (rows.length < 2) throw new Error('CSV file is empty or invalid')

      const header = rows[0].map(value => value.trim())
      const headerMap = new Map<string, number>()
      header.forEach((value, index) => {
        if (value) headerMap.set(value, index)
      })

      const atletaIndex = headerMap.get('Atleta')
      const tempoIndex = headerMap.get('Tempo')
      const societaIndex = headerMap.get('Società')
      const gareIndex = headerMap.get('Gare')
      const sessoIndex = headerMap.get('Sesso')
      const categoriaIndex = headerMap.get('Categoria')

      if (atletaIndex === undefined || gareIndex === undefined || sessoIndex === undefined || categoriaIndex === undefined) {
        throw new Error('CSV headers missing required columns (Atleta, Gare, Sesso, Categoria)')
      }

      const athletesMap = new Map<string, ParsedAthlete>()
      const eventsMap = new Map<string, ParsedEvent>()
      const entries: ParsedEntry[] = []

      rows.slice(1).forEach((row, idx) => {
        const rawAthlete = row[atletaIndex]?.trim()
        const rawEvent = row[gareIndex]?.trim()
        const rawGender = row[sessoIndex]?.trim()
        const rawCategory = row[categoriaIndex]?.trim()
        const club = societaIndex !== undefined ? (row[societaIndex]?.trim() || '') : ''

        if (!rawAthlete || !rawEvent || !rawGender || !rawCategory) return

        const parsedAthlete = parseAthleteName(rawAthlete)
        parsedAthlete.gender = rawGender

        const eventData = parseEventField(rawEvent)
        if (!eventData) return

        const gender = normalizeGender(rawGender)
        const eventKey = buildEventKey({
          distance: eventData.distance,
          stroke: eventData.stroke,
          gender,
          category: rawCategory
        })

        const athleteKey = `${normalizeText(parsedAthlete.lastname)}|${normalizeText(parsedAthlete.firstname)}|${parsedAthlete.birthdate || ''}`

        if (!athletesMap.has(athleteKey)) {
          athletesMap.set(athleteKey, parsedAthlete)
        }

        if (!eventsMap.has(eventKey)) {
          eventsMap.set(eventKey, {
            key: eventKey,
            distance: eventData.distance,
            stroke: eventData.stroke,
            gender,
            category: rawCategory,
            count: 1
          })
        } else {
          const existing = eventsMap.get(eventKey)!
          existing.count += 1
        }

        if (tempoIndex !== undefined && row[tempoIndex]?.trim().toUpperCase() === 'ST') {
          // Still import entries; timing will be replaced by PB
        }

        entries.push({
          rowIndex: idx + 2,
          athleteKey,
          eventKey,
          club
        })
      })

      const preview: PreviewData = {
        athletes: Array.from(athletesMap.values()),
        events: Array.from(eventsMap.values()),
        entries
      }

      setPreviewData(preview)
      setCurrentStep('preview')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to parse file')
    }
  }

  async function handleProceedFromPreview() {
    const { data: existingMeets } = await supabase
      .from('meets')
      .select('meet_id, meet_name, place, min_date, max_date, meet_course')
      .order('min_date', { ascending: false })
      .limit(50)

    setAvailableMeets(existingMeets || [])
    setCurrentStep('selectMeet')
  }

  async function handleProceedFromMeetSelection() {
    if (!previewData || !selectedMeetId) return

    setLoading(true)
    try {
      const { data: groups } = await supabase
        .from('_groups')
        .select('group_id, group_name')

      const groupMapping = new Map<string, number>()
      const groupOptions: GroupOption[] = (groups || []).map(group => ({
        id: group.group_id,
        name: group.group_name
      }))

      ;(groups || []).forEach(group => {
        groupMapping.set(normalizeText(group.group_name), group.group_id)
      })

      setAvailableGroups(groupOptions)

      const { data: meetEventsData } = await supabase
        .from('events')
        .select('ms_id, event_numb, ms_race_id, gender, ms_group_id')
        .eq('meet_id', selectedMeetId)
        .order('event_numb')

      const eventMsIds = (meetEventsData || []).map(event => event.ms_id)
      const { data: eventGroupsData } = eventMsIds.length > 0
        ? await supabase
            .from('event_groups')
            .select('ms_id, group_id')
            .in('ms_id', eventMsIds)
        : { data: [] }

      const eventGroupsMap = new Map<number, number[]>()
      ;(eventGroupsData || []).forEach(group => {
        const list = eventGroupsMap.get(group.ms_id) || []
        list.push(group.group_id)
        eventGroupsMap.set(group.ms_id, list)
      })

      const { data: racesData } = await supabase
        .from('_races')
        .select('race_id, distance, stroke_short_en, stroke_long_en, stroke_long_it, stroke_short_it, relay_count')
        .order('race_id')

      const raceMap = new Map((racesData || []).map(race => [race.race_id, race]))

      const eventsWithRace: DatabaseEvent[] = (meetEventsData || []).map(event => ({
        ms_id: event.ms_id,
        event_numb: event.event_numb,
        ms_race_id: event.ms_race_id,
        gender: event.gender,
        ms_group_id: event.ms_group_id,
        race: raceMap.get(event.ms_race_id),
        group_ids: eventGroupsMap.get(event.ms_id) || (event.ms_group_id ? [event.ms_group_id] : [])
      }))

      setMeetEvents(eventsWithRace)
      setAvailableRaces((racesData || []).filter(race => race.relay_count === 1))

      const mappings: EventMapping[] = previewData.events.map(fileEvent => {
        const matchingRace = (racesData || []).find(race =>
          race.distance === fileEvent.distance && matchesStroke(race, fileEvent.stroke) && race.relay_count === 1
        )

        let groupId = mapCategoryToGroupId(fileEvent.category)
        if (!groupId) {
          groupId = groupMapping.get(normalizeText(fileEvent.category)) || null
        }
        if (!groupId) {
          const normalizedCategory = normalizeText(fileEvent.category)
          const fuzzyMatch = groupOptions.find(option =>
            normalizedCategory.includes(normalizeText(option.name)) ||
            normalizeText(option.name).includes(normalizedCategory)
          )
          groupId = fuzzyMatch?.id || null
        }

        const matchedEvent = eventsWithRace
          .filter(event =>
            event.race &&
            event.race.relay_count === 1 &&
            event.race.distance === fileEvent.distance &&
            matchesStroke(event.race, fileEvent.stroke) &&
            normalizeGender(event.gender) === fileEvent.gender &&
            (groupId ? (event.group_ids || []).includes(groupId) : true)
          )
          .sort((a, b) => a.event_numb - b.event_numb)[0]

        if (matchedEvent) {
          return {
            key: fileEvent.key,
            fileEvent: {
              distance: fileEvent.distance,
              stroke: fileEvent.stroke,
              gender: fileEvent.gender,
              category: fileEvent.category
            },
            dbEventId: matchedEvent.ms_id,
            dbEventNumb: matchedEvent.event_numb,
            dbRaceId: matchedEvent.ms_race_id,
            dbRace: matchedEvent.race || null,
            dbGroupId: matchedEvent.ms_group_id,
            createNew: false
          }
        }

        return {
          key: fileEvent.key,
          fileEvent: {
            distance: fileEvent.distance,
            stroke: fileEvent.stroke,
            gender: fileEvent.gender,
            category: fileEvent.category
          },
          dbEventId: null,
          dbEventNumb: null,
          dbRaceId: matchingRace?.race_id || null,
          dbRace: matchingRace || null,
          dbGroupId: groupId,
          createNew: true
        }
      })

      setEventMappings(mappings)

      const { data: athletesData } = await supabase
        .from('athletes')
        .select('fincode, firstname, lastname, birthdate')

      const athleteMap = new Map<string, number>()
      const athleteNameMap = new Map<string, number>()
      ;(athletesData || []).forEach(athlete => {
        const key = `${normalizeText(athlete.lastname)}|${normalizeText(athlete.firstname)}|${athlete.birthdate || ''}`
        const nameKey = `${normalizeText(athlete.lastname)}|${normalizeText(athlete.firstname)}`
        athleteMap.set(key, athlete.fincode)
        if (!athleteNameMap.has(nameKey)) {
          athleteNameMap.set(nameKey, athlete.fincode)
        }
      })

      setAthleteLookup(athleteMap)
      setAthleteNameLookup(athleteNameMap)
      setCurrentStep('mapEvents')
    } catch (error) {
      console.error('Error loading meet data:', error)
      alert('Failed to load meet data')
    } finally {
      setLoading(false)
    }
  }

  function updateEventMapping(key: string, updates: Partial<EventMapping>) {
    setEventMappings(prev => prev.map(mapping => mapping.key === key ? { ...mapping, ...updates } : mapping))
  }

  async function handleImportEntries() {
    if (!previewData || !selectedMeetId || !selectedMeet || !selectedSeason) return

    setLoading(true)
    setCurrentStep('import')
    const errors: string[] = []

    try {
      const mappings = [...eventMappings]
      let nextEventNumber = meetEvents.length > 0
        ? Math.max(...meetEvents.map(event => event.event_numb)) + 1
        : 1

      for (const mapping of mappings) {
        if (!mapping.dbRaceId) {
          errors.push(`Missing race mapping for ${mapping.fileEvent.distance} ${mapping.fileEvent.stroke}`)
          continue
        }

        if (mapping.createNew || !mapping.dbEventId) {
          const { data: newEvent, error: insertError } = await supabase
            .from('events')
            .insert({
              meet_id: selectedMeetId,
              event_numb: nextEventNumber,
              ms_race_id: mapping.dbRaceId,
              gender: mapping.fileEvent.gender,
              ms_group_id: mapping.dbGroupId
            })
            .select('ms_id, event_numb')
            .single()

          if (insertError || !newEvent) {
            errors.push(`Failed to create event for ${mapping.fileEvent.distance} ${mapping.fileEvent.stroke}`)
            continue
          }

          if (mapping.dbGroupId) {
            const { error: groupError } = await supabase
              .from('event_groups')
              .insert({ ms_id: newEvent.ms_id, group_id: mapping.dbGroupId })

            if (groupError) {
              errors.push(`Failed to link group for event ${newEvent.event_numb}`)
            }
          }

          mapping.dbEventId = newEvent.ms_id
          mapping.dbEventNumb = newEvent.event_numb
          mapping.createNew = false
          nextEventNumber += 1
        }
      }

      const pbCacheByEvent = new Map<string, Map<number, { pb: number; resId: number | null }>>()

      for (const mapping of mappings) {
        if (!mapping.dbEventId || !mapping.dbRaceId) continue
        const { data: pbData, error: pbError } = await supabase
          .rpc('eligible_athletes', {
            p_season_id: selectedSeason.season_id,
            p_event_gender: mapping.fileEvent.gender,
            p_event_ms_id: mapping.dbEventId,
            p_race_id: mapping.dbRaceId,
            p_meet_course: selectedMeet.meet_course
          })

        if (pbError) {
          errors.push(`PB lookup failed for ${mapping.fileEvent.distance} ${mapping.fileEvent.stroke}`)
          continue
        }

        const pbMap = new Map<number, { pb: number; resId: number | null }>()
        ;(pbData || []).forEach((row: any) => {
          pbMap.set(row.fincode, {
            pb: row.personal_best || 0,
            resId: row.pb_res_id || null
          })
        })

        pbCacheByEvent.set(mapping.key, pbMap)
      }

      const entriesToInsert = [] as Array<{
        fincode: number
        meet_id: number
        event_numb: number
        res_time_decimal: number
        entry_time_decimal: number
        entry_time_res_id: number | null
        status: number
      }>

      let skipped = 0
      for (const entry of previewData.entries) {
        const mapping = mappings.find(m => m.key === entry.eventKey)
        if (!mapping || !mapping.dbEventNumb) {
          skipped += 1
          errors.push(`Row ${entry.rowIndex}: event not mapped`)
          continue
        }

        let fincode = athleteLookup.get(entry.athleteKey)
        if (!fincode) {
          const nameKey = entry.athleteKey.split('|').slice(0, 2).join('|')
          fincode = athleteNameLookup.get(nameKey)
        }
        if (!fincode) {
          skipped += 1
          errors.push(`Row ${entry.rowIndex}: athlete not found`) 
          continue
        }

        const pbMap = pbCacheByEvent.get(mapping.key)
        const pb = pbMap?.get(fincode)

        entriesToInsert.push({
          fincode,
          meet_id: selectedMeetId,
          event_numb: mapping.dbEventNumb,
          res_time_decimal: 0,
          entry_time_decimal: pb?.pb || 0,
          entry_time_res_id: pb?.resId || null,
          status: 0
        })
      }

      let imported = 0
      const chunkSize = 200
      for (let i = 0; i < entriesToInsert.length; i += chunkSize) {
        const chunk = entriesToInsert.slice(i, i + chunkSize)
        const { error: insertError } = await supabase
          .from('results')
          .upsert(chunk, { onConflict: 'fincode,meet_id,event_numb,res_time_decimal', ignoreDuplicates: false })

        if (insertError) {
          errors.push(`Failed to import entries batch ${i / chunkSize + 1}: ${insertError.message}`)
        } else {
          imported += chunk.length
        }
      }

      setResult({
        success: errors.length === 0,
        message: errors.length === 0 ? 'Entries imported successfully.' : 'Imported with warnings.',
        details: {
          entriesProcessed: previewData.entries.length,
          entriesImported: imported,
          entriesSkipped: skipped,
          errors
        }
      })

      setCurrentStep('complete')
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import entries',
        details: {
          entriesProcessed: previewData.entries.length,
          entriesImported: 0,
          entriesSkipped: previewData.entries.length,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      })
      setCurrentStep('complete')
    } finally {
      setLoading(false)
    }
  }

  const unmappedEvents = eventMappings.filter(mapping => mapping.createNew && !mapping.dbRaceId).length
  const sortedEventMappings = [...eventMappings].sort((a, b) => {
    const aNumb = a.dbEventNumb ?? Number.MAX_SAFE_INTEGER
    const bNumb = b.dbEventNumb ?? Number.MAX_SAFE_INTEGER
    return aNumb - bNumb
  })
  const importableMeetEvents = meetEvents.filter(event => event.race?.relay_count === 1)
  const unmatchedAthletes = previewData
    ? previewData.athletes.filter(athlete => {
        const key = `${normalizeText(athlete.lastname)}|${normalizeText(athlete.firstname)}|${athlete.birthdate || ''}`
        const nameKey = `${normalizeText(athlete.lastname)}|${normalizeText(athlete.firstname)}`
        return !athleteLookup.has(key) && !athleteNameLookup.has(nameKey)
      })
    : []
  const missingAthletesCount = previewData
    ? unmatchedAthletes.length
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Import Entries</h1>
        <p className="mt-2 text-muted-foreground">
          Import entry lists, map them to a meet, and prefill entry times with personal bests.
        </p>
      </div>

      {currentStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Use the federazione CSV export with columns like Atleta, Tempo, Società, Gare, Sesso, Categoria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept=".csv" onChange={handleFileSelect} />
            <div className="flex gap-3">
              <Button onClick={handleParseFile} disabled={!selectedFile || loading}>
                <Upload className="h-4 w-4 mr-2" />
                Parse file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'preview' && previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              {previewData.entries.length} entries • {previewData.athletes.length} athletes • {previewData.events.length} events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              {previewData.events.map(event => (
                <div key={event.key} className="flex justify-between">
                  <span>{event.distance} {event.stroke} • {event.gender} • {event.category}</span>
                  <span className="text-muted-foreground">{event.count} entries</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                Back
              </Button>
              <Button onClick={handleProceedFromPreview} disabled={loading}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'selectMeet' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Meet</CardTitle>
            <CardDescription>Select the meet to attach these entries to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedMeetId?.toString() || ''} onValueChange={(value) => setSelectedMeetId(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a meet" />
              </SelectTrigger>
              <SelectContent>
                {availableMeets.map(meet => (
                  <SelectItem key={meet.meet_id} value={meet.meet_id.toString()}>
                    {meet.meet_name} • {meet.place} • {meet.min_date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('preview')}>
                Back
              </Button>
              <Button onClick={handleProceedFromMeetSelection} disabled={!selectedMeetId || loading}>
                Continue to event mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'mapEvents' && (
        <Card>
          <CardHeader>
            <CardTitle>Map Events</CardTitle>
            <CardDescription>
              Match CSV events to meet events or create new ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sortedEventMappings.map((mapping) => (
              <div key={mapping.key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {mapping.fileEvent.distance} {mapping.fileEvent.stroke} • {mapping.fileEvent.gender} • {mapping.fileEvent.category}
                  </div>
                  <span className="text-xs text-muted-foreground">{mapping.createNew ? 'New event' : `Event #${mapping.dbEventNumb}`}</span>
                </div>

                <Select
                  value={mapping.createNew ? 'new' : mapping.dbEventId?.toString() || 'new'}
                  onValueChange={(value) => {
                    if (value === 'new') {
                      updateEventMapping(mapping.key, {
                        createNew: true,
                        dbEventId: null,
                        dbEventNumb: null
                      })
                      return
                    }
                    const selected = importableMeetEvents.find(event => event.ms_id === Number(value))
                    updateEventMapping(mapping.key, {
                      createNew: false,
                      dbEventId: selected?.ms_id || null,
                      dbEventNumb: selected?.event_numb || null,
                      dbRaceId: selected?.ms_race_id || null,
                      dbRace: selected?.race || null,
                      dbGroupId: selected?.ms_group_id || null
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create new event</SelectItem>
                    {importableMeetEvents.map(event => (
                      <SelectItem key={event.ms_id} value={event.ms_id.toString()}>
                        Event #{event.event_numb} • {event.race?.distance} {event.race?.stroke_short_en} • {event.gender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {mapping.createNew && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Race</span>
                      <Select
                        value={mapping.dbRaceId?.toString() || ''}
                        onValueChange={(value) => {
                          const race = availableRaces.find(r => r.race_id === Number(value)) || null
                          updateEventMapping(mapping.key, { dbRaceId: race?.race_id || null, dbRace: race })
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select race" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRaces.map(race => (
                            <SelectItem key={race.race_id} value={race.race_id.toString()}>
                              {race.distance} {race.stroke_long_it || race.stroke_short_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Group</span>
                      <Select
                        value={mapping.dbGroupId?.toString() || ''}
                        onValueChange={(value) => updateEventMapping(mapping.key, { dbGroupId: Number(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGroups.map(group => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {missingAthletesCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                {missingAthletesCount} athletes could not be matched and will be skipped.
              </div>
            )}

            {missingAthletesCount > 0 && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Unmatched athletes preview</div>
                <div className="grid gap-1 text-xs text-muted-foreground">
                  {unmatchedAthletes.slice(0, 15).map((athlete) => (
                    <div key={`${athlete.lastname}-${athlete.firstname}-${athlete.birthdate || 'na'}`}>
                      {athlete.lastname} {athlete.firstname}{athlete.birthdate ? ` • ${athlete.birthdate}` : ''}
                    </div>
                  ))}
                  {unmatchedAthletes.length > 15 && (
                    <div>And {unmatchedAthletes.length - 15} more...</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('selectMeet')}>
                Back
              </Button>
              <Button onClick={handleImportEntries} disabled={loading || unmappedEvents > 0}>
                Import entries
              </Button>
            </div>
            {unmappedEvents > 0 && (
              <div className="text-xs text-muted-foreground">Map all races before importing.</div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'import' && (
        <Card>
          <CardHeader>
            <CardTitle>Importing</CardTitle>
            <CardDescription>Processing entries. Please wait.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Working...</CardContent>
        </Card>
      )}

      {currentStep === 'complete' && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {result.message}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Processed: {result.details?.entriesProcessed ?? 0}</div>
            <div>Imported: {result.details?.entriesImported ?? 0}</div>
            <div>Skipped: {result.details?.entriesSkipped ?? 0}</div>
            {result.details?.errors && result.details.errors.length > 0 && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.details.errors.slice(0, 10).map((err, idx) => (
                  <div key={idx}>• {err}</div>
                ))}
                {result.details.errors.length > 10 && (
                  <div>And {result.details.errors.length - 10} more...</div>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => {
                setCurrentStep('upload')
                setSelectedFile(null)
                setPreviewData(null)
                setSelectedMeetId(null)
                setEventMappings([])
                setResult(null)
              }}>
                Import another file
              </Button>
            </div>
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <Info className="h-4 w-4" />
                Remember to:
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Manually add the event_groups rows (ms_id &amp; group_id).</li>
                <li>Run the function "select update_entries_with_pb()".</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
