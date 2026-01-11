import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Plus, Search, MapPin, Calendar, Trophy, ArrowLeft } from 'lucide-react'
import type { Meet, Event, Result, Split, Athlete, Race, ResultStatus } from '@/types/database'
import { useSeason } from '@/contexts/SeasonContext'
import { RelayEntriesModal } from '@/components/RelayEntriesModal'

interface Group {
  id: number
  group_name: string
}

interface EventWithRace extends Event {
  race?: Race
  group?: Group
}

interface ResultWithAthlete extends Result {
  athlete?: Athlete
  event?: EventWithRace
  race?: Race
  formattedTime?: string
}

interface RelayResultWithEvent {
  relay_result_id: number
  meet_id: number
  event_numb: number
  relay_name: string
  leg1_fincode: number
  leg1_entry_time: number
  leg1_res_time: number
  leg2_fincode: number
  leg2_entry_time: number
  leg2_res_time: number
  leg3_fincode: number
  leg3_entry_time: number
  leg3_res_time: number
  leg4_fincode: number
  leg4_entry_time: number
  leg4_res_time: number
  result_status?: string
  created_at?: string
  updated_at?: string
  event?: EventWithRace
  race?: Race
  formattedTime?: string
  totalTime?: number
}

interface SplitData {
  result: ResultWithAthlete
  splits: (Split & { formattedTime?: string })[]
}

export function Meets() {
  const { selectedSeason } = useSeason()
  const [meets, setMeets] = useState<Meet[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMeet, setSelectedMeet] = useState<Meet | null>(null)
  const [viewingResults, setViewingResults] = useState(false)
  const [events, setEvents] = useState<EventWithRace[]>([])
  const [results, setResults] = useState<ResultWithAthlete[]>([])
  const [relayResults, setRelayResults] = useState<RelayResultWithEvent[]>([])
  const [meetStats, setMeetStats] = useState<{ eventsCount: number; entriesCount: number; resultsCount: number }>({ eventsCount: 0, entriesCount: 0, resultsCount: 0 })
  const [selectedResult, setSelectedResult] = useState<SplitData | null>(null)
  const [selectedRelayResult, setSelectedRelayResult] = useState<RelayResultWithEvent | null>(null)
  const [relayAthletes, setRelayAthletes] = useState<Map<number, Athlete>>(new Map())
  const [loadingResults, setLoadingResults] = useState(false)
  const [editingMeet, setEditingMeet] = useState<Meet | null>(null)
  const [editForm, setEditForm] = useState<Partial<Meet>>({})
  const [creatingMeet, setCreatingMeet] = useState(false)
  const [createForm, setCreateForm] = useState<Partial<Meet>>({})
  const [viewingEvents, setViewingEvents] = useState(false)
  const [meetEvents, setMeetEvents] = useState<EventWithRace[]>([])
  const [eventEntryCounts, setEventEntryCounts] = useState<Map<number, number>>(new Map())
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [availableRaces, setAvailableRaces] = useState<Race[]>([])
  const [editingEvent, setEditingEvent] = useState<EventWithRace | null>(null)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [eventForm, setEventForm] = useState<Partial<Event>>({})
  const [loadingRaces, setLoadingRaces] = useState(false)
  const [raceTypeFilter, setRaceTypeFilter] = useState<'IND' | 'REL'>('IND')
  const [addingEntriesForEvent, setAddingEntriesForEvent] = useState<EventWithRace | null>(null)
  const [eventAthletes, setEventAthletes] = useState<(Athlete & { group_id?: number, personalBest?: number, formattedPersonalBest?: string })[]>([])
  const [selectedAthletes, setSelectedAthletes] = useState<Set<number>>(new Set())
  const [originalEntries, setOriginalEntries] = useState<Set<number>>(new Set())
  const [loadingEventAthletes, setLoadingEventAthletes] = useState(false)
  const [savingEventEntries, setSavingEventEntries] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<Group[]>([])
  const [editingResult, setEditingResult] = useState<ResultWithAthlete | null>(null)
  const [resultTimeInput, setResultTimeInput] = useState('')
  const [creatingResult, setCreatingResult] = useState<EventWithRace | null>(null)
  const [newResultForm, setNewResultForm] = useState<{ fincode: number; timeInput: string }>({
    fincode: 0,
    timeInput: ''
  })
  const [availableAthletesForResult, setAvailableAthletesForResult] = useState<Athlete[]>([])
  const [splitInputs, setSplitInputs] = useState<{ distance: number; timeInput: string; splits_id?: number }[]>([])
  const [savingSplits, setSavingSplits] = useState(false)
  const [editingSplits, setEditingSplits] = useState(false)
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const [addingRelayEntriesForEvent, setAddingRelayEntriesForEvent] = useState<EventWithRace | null>(null)
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())
  const [editingRelayResult, setEditingRelayResult] = useState<RelayResultWithEvent | null>(null)
  const [relayLegInputs, setRelayLegInputs] = useState<{
    leg1: string
    leg2: string
    leg3: string
    leg4: string
  }>({ leg1: '', leg2: '', leg3: '', leg4: '' })

  useEffect(() => {
    if (selectedSeason) {
      fetchMeets()
    }
  }, [selectedSeason])

  useEffect(() => {
    // Load all groups on component mount
    loadAllGroups()
  }, [])

  async function loadAllGroups() {
    try {
      const { data, error } = await supabase
        .from('_groups')
        .select('*')
        .order('id', { ascending: true })
      
      if (error) throw error
      setAllGroups(data || [])
    } catch (error) {
    }
  }

  // Convert mmsshh to milliseconds
  function timeStringToMilliseconds(timeStr: string): number {
    // Remove any non-digit characters and pad with zeros if needed
    const cleaned = timeStr.replace(/\D/g, '')
    if (cleaned.length !== 6) return 0
    
    const minutes = parseInt(cleaned.substring(0, 2), 10)
    const seconds = parseInt(cleaned.substring(2, 4), 10)
    const centiseconds = parseInt(cleaned.substring(4, 6), 10)
    
    return (minutes * 60 * 1000) + (seconds * 1000) + (centiseconds * 10)
  }

  // Convert milliseconds to mmsshh
  function millisecondsToTimeString(ms: number): string {
    const totalSeconds = ms / 1000.0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const centiseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100)
    
    return `${minutes.toString().padStart(2, '0')}${seconds.toString().padStart(2, '0')}${centiseconds.toString().padStart(2, '0')}`
  }

  async function fetchMeets() {
    if (!selectedSeason) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('meets')
        .select('*')
        .gte('min_date', selectedSeason.season_start)
        .lte('max_date', selectedSeason.season_end)
        .order('min_date', { ascending: false })

      if (error) throw error
      setMeets(data || [])
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const filteredMeets = meets.filter(meet =>
    meet.meet_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meet.place.toLowerCase().includes(searchTerm.toLowerCase()) ||
    meet.nation.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  // Fetch meet statistics when a meet is selected
  async function fetchMeetStats(meet: Meet) {
    try {
      // Count events using the RPC function
      const { data: eventsData, error: eventsError } = await supabase
        .rpc('get_meet_events_with_details', { p_meet_id: meet.meet_id })
      
      if (eventsError) {
        console.error('Error fetching events:', eventsError)
      }
      
      const eventsCount = eventsData?.length || 0
      
      // Count entries: results with status=0 (entered, not yet finished)
      const { count: entriesCount } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
        .eq('status', 0)
      
      const { count: relayEntriesCount } = await supabase
        .from('relay_results')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
        .eq('status', 0)
      
      const totalEntriesCount = (entriesCount || 0) + (relayEntriesCount || 0)
      
      // Count results: results with status 1-4 (DSQ, DNF, DNS, FINISHED)
      const { count: resultsCount } = await supabase
        .from('results')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
        .not('status', 'is', null)
        .neq('status', 0)
      
      const { count: relayResultsCount } = await supabase
        .from('relay_results')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
        .not('status', 'is', null)
        .neq('status', 0)
      
      const totalResultsCount = (resultsCount || 0) + (relayResultsCount || 0)
      
      setMeetStats({
        eventsCount: eventsCount || 0,
        entriesCount: totalEntriesCount,
        resultsCount: totalResultsCount
      })
    } catch (error) {
      console.error('Error fetching meet stats:', error)
      setMeetStats({ eventsCount: 0, entriesCount: 0, resultsCount: 0 })
    }
  }

  async function handleViewResults(meet: Meet) {
    setSelectedMeet(meet)
    setViewingResults(true)
    setLoadingResults(true)
    
    try {
      // Fetch events with all joined data using SQL function
      const { data: eventsData, error: eventsError } = await supabase
        .rpc('get_meet_events_with_details', { p_meet_id: meet.meet_id })

      if (eventsError) {
        throw eventsError
      }
      
      // Count events
      const eventsCount = eventsData?.length || 0

      // Transform data to match EventWithRace interface
      const eventsWithRaces: EventWithRace[] = (eventsData || []).map((e: any) => ({
        ms_id: e.ms_id,
        meet_id: e.meet_id,
        event_numb: e.event_numb,
        ms_race_id: e.ms_race_id,
        gender: e.gender,
        ms_group_id: e.ms_group_id,
        created_at: e.created_at,
        race: e.race_id ? {
          race_id: e.race_id,
          race_id_fin: e.race_id_fin,
          distance: e.distance,
          stroke_short_en: e.stroke_short_en,
          stroke_long_en: e.stroke_long_en,
          stroke_long_it: e.stroke_long_it,
          relay_count: e.relay_count
        } : undefined,
        group: e.group_id ? {
          id: e.group_id,
          group_name: e.group_name
        } : undefined
      }))

      setEvents(eventsWithRaces)
      
      // Fetch entries count for this meet (both individual and relay)
      const { count: entriesCount } = await supabase
        .from('entries')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
      
      const { count: relayEntriesCount } = await supabase
        .from('relay_entries')
        .select('*', { count: 'exact', head: true })
        .eq('meet_id', meet.meet_id)
      
      const totalEntriesCount = (entriesCount || 0) + (relayEntriesCount || 0)

      // Fetch results for this meet
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('meet_id', meet.meet_id)
        .order('event_numb', { ascending: true })
        .order('res_time_decimal', { ascending: true })

      if (resultsError) {
        throw resultsError
      }

      // Fetch athletes data for all results
      const fincodes = [...new Set(resultsData?.map(r => r.fincode) || [])]
      const { data: athletesData, error: athletesError } = await supabase
        .from('athletes')
        .select('*')
        .in('fincode', fincodes)

      if (athletesError) {
      }

      // Create athlete lookup map
      const athleteMap = new Map(athletesData?.map(a => [a.fincode, a]) || [])
      
      // Create event lookup map
      const eventMap = new Map(eventsWithRaces?.map(e => [`${e.meet_id}-${e.event_numb}`, e]) || [])

      // Combine results with athlete and event data
      const transformedResults = (resultsData || []).map((r: any) => {
        const eventKey = `${r.meet_id}-${r.event_numb}`
        const event = eventMap.get(eventKey)
        return {
          ...r,
          athlete: athleteMap.get(r.fincode),
          event: event,
          race: event?.race
        }
      })
      
      // Format times using Supabase function
      const resultsWithFormattedTimes = await formatTimesInResults(transformedResults)
      
      setResults(resultsWithFormattedTimes)

      // Fetch relay results for this meet
      const { data: relayResultsData, error: relayResultsError } = await supabase
        .from('relay_results')
        .select('*')
        .eq('meet_id', meet.meet_id)
        .order('event_numb', { ascending: true })

      if (relayResultsError) {
      } else {
        // Combine relay results with event data and calculate total times
        const transformedRelayResults = (relayResultsData || []).map((r: any) => {
          const eventKey = `${r.meet_id}-${r.event_numb}`
          const event = eventMap.get(eventKey)
          // Calculate total time as sum of all leg times
          const totalTime = (r.leg1_res_time || 0) + (r.leg2_res_time || 0) + (r.leg3_res_time || 0) + (r.leg4_res_time || 0)
          return {
            ...r,
            event: event,
            race: event?.race,
            totalTime: totalTime
          }
        })
        
        // Sort by total time
        transformedRelayResults.sort((a, b) => {
          if (a.event_numb !== b.event_numb) return a.event_numb - b.event_numb
          return (a.totalTime || 0) - (b.totalTime || 0)
        })
        
        // Format times for relay results
        const relayResultsWithFormattedTimes = await formatTimesInRelayResults(transformedRelayResults)
        setRelayResults(relayResultsWithFormattedTimes)
      }
      
      // Update meet statistics
      const totalResultsCount = (resultsData?.length || 0) + (relayResultsData?.length || 0)
      setMeetStats({
        eventsCount,
        entriesCount: totalEntriesCount,
        resultsCount: totalResultsCount
      })
    } catch (error) {
    } finally {
      setLoadingResults(false)
    }
  }

  async function handleViewRelaySplits(relayResult: RelayResultWithEvent) {
    // Fetch athlete data for all legs
    const fincodes = [
      relayResult.leg1_fincode,
      relayResult.leg2_fincode,
      relayResult.leg3_fincode,
      relayResult.leg4_fincode
    ].filter(fc => fc && fc > 0)
    
    if (fincodes.length > 0) {
      const { data: athletesData } = await supabase
        .from('athletes')
        .select('*')
        .in('fincode', fincodes)
      
      if (athletesData) {
        const athleteMap = new Map(athletesData.map(a => [a.fincode, a]))
        setRelayAthletes(athleteMap)
      }
    }
    
    setSelectedRelayResult(relayResult)
  }

  async function handleViewSplits(result: ResultWithAthlete) {
    try {
      // Check if result time is zero - splits cannot be entered until final time is set
      if (result.res_time_decimal === 0) {
        alert('Please enter the final result time before adding splits.')
        return
      }

      // Get the race distance
      const distance = result.race?.distance || 0
      
      // Fetch existing splits
      const { data: splitsData, error: splitsError } = await supabase
        .from('splits')
        .select('*')
        .eq('splits_res_id', result.res_id)
        .order('distance', { ascending: true })

      if (splitsError) throw splitsError
      
      // Format times using Supabase function
      const splitsWithFormattedTimes = await formatTimesInSplits(splitsData || [])
      
      setSelectedResult({
        result,
        splits: splitsWithFormattedTimes
      })
      
      // Reset edit mode to default read view
      setEditingSplits(false)

      // Initialize split inputs
      if (splitsData && splitsData.length > 0) {
        // Use existing splits and store formatted time
        const inputs = splitsData.map(split => ({
          distance: split.distance,
          timeInput: formatTime(split.split_time),
          splits_id: split.splits_id
        }))
        
        // Always ensure the last input (final distance) has the result time
        const finalSplit = inputs.find(input => input.distance === distance)
        if (finalSplit) {
          finalSplit.timeInput = formatTime(result.res_time_decimal)
        } else if (distance > 0) {
          // Add final distance split if it doesn't exist
            inputs.push({
              distance: distance,
              timeInput: formatTime(result.res_time_decimal),
              splits_id: undefined
            })
        }
        
        setSplitInputs(inputs.sort((a, b) => a.distance - b.distance))
      } else {
        // Generate empty splits based on distance
        const emptySplits = generateEmptySplits(distance)
        
        // Set the last split to the final result time
        if (emptySplits.length > 0 && distance > 0) {
          emptySplits[emptySplits.length - 1].timeInput = formatTime(result.res_time_decimal)
        }
        
        setSplitInputs(emptySplits)
      }
    } catch (error) {
    }
  }

  function getCourseLength(courseCode: number): string {
    return courseCode === 1 ? '50m' : '25m'
  }

  // Format result display based on status
  function formatResultDisplay(result: ResultWithAthlete): string {
    if (!result.result_status || result.result_status === 'FINISHED') {
      return result.formattedTime || formatTime(result.res_time_decimal)
    }
    return result.result_status // Returns 'DNS', 'DNF', or 'DSQ'
  }

  // Calculate split intervals based on distance
  function getSplitIntervals(distance: number): number[] {
    // For 800m and 1500m, use 100m intervals
    if (distance === 800 || distance === 1500) {
      const intervals: number[] = []
      for (let i = 100; i <= distance; i += 100) {
        intervals.push(i)
      }
      return intervals
    }
    
    // For all other distances, use 50m intervals
    const intervals: number[] = []
    for (let i = 50; i <= distance; i += 50) {
      intervals.push(i)
    }
    return intervals
  }

  // Generate empty split inputs for a given distance
  function generateEmptySplits(distance: number): { distance: number; timeInput: string }[] {
    const intervals = getSplitIntervals(distance)
    return intervals.map(dist => ({
      distance: dist,
      timeInput: ''
    }))
  }

  function formatTime(decimalTime: number): string {
    const totalSeconds = decimalTime / 1000.0
    const minutes = Math.floor(totalSeconds / 60)
    const secondsWhole = Math.floor(totalSeconds % 60)
    const centiseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100)
    
    return `${minutes.toString().padStart(2, '0')}:${secondsWhole.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
  }

  // Convert formatted time with possible underscores to mm:ss.cc
  function formattedTimeToDisplay(timeStr: string): string {
    // Replace underscores with zeros for display
    return timeStr.replace(/_/g, '0')
  }

  async function formatTimeWithSupabase(decimalTime: number): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('totaltime_to_timestr', { 
        totaltime: decimalTime 
      })
      
      if (error) {
        return formatTime(decimalTime) // Fallback to local formatting
      }
      
      return data || formatTime(decimalTime)
    } catch (error) {
      return formatTime(decimalTime) // Fallback to local formatting
    }
  }

  // Format times for display
  async function formatTimesInResults(resultsData: ResultWithAthlete[]) {
    const formattedResults = await Promise.all(
      resultsData.map(async (result) => ({
        ...result,
        formattedTime: await formatTimeWithSupabase(result.res_time_decimal)
      }))
    )
    return formattedResults
  }

  async function formatTimesInRelayResults(relayResultsData: RelayResultWithEvent[]) {
    if (relayResultsData.length === 0) return relayResultsData

    const timesToFormat = relayResultsData
      .filter(r => r.totalTime && r.totalTime > 0)
      .map(r => r.totalTime!)

    if (timesToFormat.length === 0) return relayResultsData

    try {
      const { data: formattedData, error } = await supabase
        .rpc('format_times_batch', { times_array: timesToFormat })

      if (error) {
        return relayResultsData
      }

      // Create a map of time -> formatted time
      const timeMap = new Map<number, string>()
      formattedData?.forEach((item: { time_decimal: number, formatted_time: string }) => {
        timeMap.set(item.time_decimal, item.formatted_time)
      })

      // Add formatted times to relay results
      return relayResultsData.map(r => ({
        ...r,
        formattedTime: r.totalTime && r.totalTime > 0 ? timeMap.get(r.totalTime) : undefined
      }))
    } catch (error) {
      return relayResultsData
    }
  }

  async function formatTimesInSplits(splitsData: Split[]) {
    const formattedSplits = await Promise.all(
      splitsData.map(async (split) => ({
        ...split,
        formattedTime: await formatTimeWithSupabase(split.split_time)
      }))
    )
    return formattedSplits
  }

  async function handleSaveSplits() {
    if (!selectedResult) return

    try {
      setSavingSplits(true)

      // Filter out inputs with underscores (incomplete times) and convert to milliseconds
      const splitsToSave = splitInputs
        .filter(input => {
          const hasUnderscore = input.timeInput.includes('_')
          const isEmpty = input.timeInput.trim() === '' || input.timeInput === '__:__.__'
          return !hasUnderscore && !isEmpty
        })
        .map(input => {
          // Convert formatted time (mm:ss.cc) to milliseconds
          const timeParts = input.timeInput.match(/(\d{2}):(\d{2})\.(\d{2})/)
          if (!timeParts) {
            throw new Error(`Invalid time format: ${input.timeInput}`)
          }
          const minutes = parseInt(timeParts[1], 10)
          const seconds = parseInt(timeParts[2], 10)
          const centiseconds = parseInt(timeParts[3], 10)
          const milliseconds = (minutes * 60 * 1000) + (seconds * 1000) + (centiseconds * 10)
          
          return {
            splits_res_id: selectedResult.result.res_id,
            distance: input.distance,
            split_time: milliseconds,
            splits_id: input.splits_id
          }
        })

      // Get existing split IDs
      const existingSplitIds = splitInputs
        .filter(input => input.splits_id)
        .map(input => input.splits_id!)

      // Delete splits that were removed
      const { data: currentSplits } = await supabase
        .from('splits')
        .select('splits_id')
        .eq('splits_res_id', selectedResult.result.res_id)

      if (currentSplits) {
        const splitsToDelete = currentSplits
          .filter(split => !existingSplitIds.includes(split.splits_id))
          .map(split => split.splits_id)

        if (splitsToDelete.length > 0) {
          await supabase
            .from('splits')
            .delete()
            .in('splits_id', splitsToDelete)
        }
      }

      // Upsert splits (update existing, insert new)
      for (const split of splitsToSave) {
        if (split.splits_id) {
          // Update existing split
          const { error: updateError } = await supabase
            .from('splits')
            .update({
              distance: split.distance,
              split_time: split.split_time,
              updated_at: new Date().toISOString()
            })
            .eq('splits_id', split.splits_id)

          if (updateError) throw updateError
        } else {
          // Insert new split
          const { error: insertError } = await supabase
            .from('splits')
            .insert({
              splits_res_id: split.splits_res_id,
              distance: split.distance,
              split_time: split.split_time
            })

          if (insertError) throw insertError
        }
      }

      // Close splits modal and exit edit mode
      setSelectedResult(null)
      setSplitInputs([])
      setEditingSplits(false)
      
    } catch (error) {
      alert('Error saving splits. Please try again.')
    } finally {
      setSavingSplits(false)
    }
  }

  function closeResultsView() {
    setViewingResults(false)
    setEvents([])
    setResults([])
    setRelayResults([])
    setSelectedResult(null)
    setEditingResult(null)
    setResultTimeInput('')
    setCreatingResult(null)
    setNewResultForm({ fincode: 0, timeInput: '' })
  }

  async function handleEditMeet(meet: Meet) {
    setEditingMeet(meet)
    setEditForm(meet)
    setSelectedMeet(null)
    
    // Load existing group associations
    try {
      const { data, error } = await supabase
        .from('meet_groups')
        .select('group_id')
        .eq('meet_id', meet.meet_id)
      
      if (error) throw error
      
      const groupIds = new Set(data?.map(mg => mg.group_id) || [])
      setSelectedGroupIds(groupIds)
    } catch (error) {
      setSelectedGroupIds(new Set())
    }
  }

  async function handleSaveEdit() {
    if (!editingMeet || !editForm) return

    try {
      const { error } = await supabase
        .from('meets')
        .update({
          meet_name: editForm.meet_name,
          pool_name: editForm.pool_name,
          place: editForm.place,
          nation: editForm.nation,
          min_date: editForm.min_date,
          max_date: editForm.max_date,
          meet_course: editForm.meet_course,
        })
        .eq('meet_id', editingMeet.meet_id)

      if (error) throw error

      // Update group associations
      // First, delete all existing associations
      const { error: deleteError } = await supabase
        .from('meet_groups')
        .delete()
        .eq('meet_id', editingMeet.meet_id)

      if (deleteError) throw deleteError

      // Then, insert new associations
      if (selectedGroupIds.size > 0) {
        const groupInserts = Array.from(selectedGroupIds).map(group_id => ({
          meet_id: editingMeet.meet_id,
          group_id
        }))

        const { error: insertError } = await supabase
          .from('meet_groups')
          .insert(groupInserts)

        if (insertError) throw insertError
      }

      // Refresh meets list
      await fetchMeets()
      setEditingMeet(null)
      setEditForm({})
      setSelectedGroupIds(new Set())
    } catch (error) {
      alert('Failed to update meet')
    }
  }

  function handleAddNewMeet() {
    setCreateForm({
      meet_name: '',
      pool_name: '',
      place: '',
      nation: '',
      min_date: '',
      max_date: '',
      meet_course: 1
    })
    setSelectedGroupIds(new Set())
    setCreatingMeet(true)
  }

  async function handleCreateMeet() {
    if (!createForm.meet_name || !createForm.min_date || !createForm.max_date) {
      alert('Please fill in all required fields')
      return
    }

    try {
      // Create the meet and get the generated meet_id
      const { data: meetData, error: meetError } = await supabase
        .from('meets')
        .insert([{
          meet_name: createForm.meet_name,
          pool_name: createForm.pool_name || '',
          place: createForm.place || '',
          nation: createForm.nation || '',
          min_date: createForm.min_date,
          max_date: createForm.max_date,
          meet_course: createForm.meet_course || 1
        }])
        .select()
        .single()

      if (meetError) throw meetError

      // Insert group associations if any groups are selected
      if (selectedGroupIds.size > 0 && meetData) {
        const groupInserts = Array.from(selectedGroupIds).map(group_id => ({
          meet_id: meetData.meet_id,
          group_id
        }))

        const { error: groupError } = await supabase
          .from('meet_groups')
          .insert(groupInserts)

        if (groupError) throw groupError
      }

      // Refresh meets list
      await fetchMeets()
      setCreatingMeet(false)
      setCreateForm({})
      setSelectedGroupIds(new Set())
    } catch (error) {
      alert('Failed to create meet')
    }
  }

  async function handleViewEvents(meet: Meet) {
    setSelectedMeet(meet)
    setViewingEvents(true)
    setLoadingEvents(true)
    setLoadingRaces(true)
    
    try {
      // Fetch groups associated with this meet through the pivot table
      const { data: meetGroupsData, error: meetGroupsError } = await supabase
        .from('meet_groups')
        .select('group_id')
        .eq('meet_id', meet.meet_id)
      
      if (meetGroupsError) {
      }

      // Get group IDs from pivot table
      const meetGroupIds = meetGroupsData?.map(mg => mg.group_id) || []
      
      // Fetch the actual group data for these IDs only
      if (meetGroupIds.length > 0) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('_groups')
          .select('*')
          .in('id', meetGroupIds)
          .order('id', { ascending: true })
        
        if (groupsError) {
        } else {
          setAvailableGroups(groupsData || [])
        }
      } else {
        setAvailableGroups([])
      }
      
      // Fetch events with all joined data using SQL function
      const { data: eventsData, error: eventsError } = await supabase
        .rpc('get_meet_events_with_details', { p_meet_id: meet.meet_id })

      if (eventsError) {
        throw eventsError
      }

      // Transform data to match EventWithRace interface
      const eventsWithRaces: EventWithRace[] = (eventsData || []).map((e: any) => ({
        ms_id: e.ms_id,
        meet_id: e.meet_id,
        event_numb: e.event_numb,
        ms_race_id: e.ms_race_id,
        gender: e.gender,
        ms_group_id: e.ms_group_id,
        created_at: e.created_at,
        race: e.race_id ? {
          race_id: e.race_id,
          race_id_fin: e.race_id_fin,
          distance: e.distance,
          stroke_short_en: e.stroke_short_en,
          stroke_long_en: e.stroke_long_en,
          stroke_long_it: e.stroke_long_it,
          relay_count: e.relay_count
        } : undefined,
        group: e.group_id ? {
          id: e.group_id,
          group_name: e.group_name
        } : undefined
      }))

      setMeetEvents(eventsWithRaces)

      // Fetch entry counts for all events
      await fetchEventEntryCounts(meet.meet_id)

      // Fetch filtered races for the dropdown (based on current filter)
      const relayCount = raceTypeFilter === 'IND' ? 1 : 4
      const { data: filteredRacesData, error: filteredRacesError } = await supabase
        .from('_races')
        .select('*')
        .eq('relay_count', relayCount)
        .order('race_id_fin', { ascending: true })

      if (filteredRacesError) {
      } else {
        setAvailableRaces(filteredRacesData || [])
      }
      setLoadingRaces(false)
    } catch (error) {
    } finally {
      setLoadingEvents(false)
    }
  }

  async function handleAddEvent() {
    if (!selectedMeet) return
    
    // Fetch all groups from _groups table if not already loaded
    if (availableGroups.length === 0) {
      const { data: groupsData, error: groupsError } = await supabase
        .from('_groups')
        .select('*')
        .order('id', { ascending: true })
      
      if (groupsError) {
      } else {
        setAvailableGroups(groupsData || [])
      }
    }
    
    // Keep the previous race selection if available
    const previousRaceId = eventForm.ms_race_id || availableRaces[0]?.race_id || 0
    
    // Alternate gender: if previous was 'M', switch to 'W', and vice versa
    const previousGender = eventForm.gender || 'M'
    const newGender = previousGender === 'M' ? 'W' : 'M'
    
    setEventForm({
      meet_id: selectedMeet.meet_id,
      event_numb: meetEvents.length > 0 ? Math.max(...meetEvents.map(e => e.event_numb)) + 1 : 1,
      ms_race_id: previousRaceId,
      gender: newGender,
      ms_group_id: eventForm.ms_group_id || 1
    })
    setCreatingEvent(true)
  }

  function handleEditEvent(event: EventWithRace) {
    setEditingEvent(event)
    setEventForm({
      meet_id: event.meet_id,
      event_numb: event.event_numb,
      ms_race_id: event.ms_race_id,
      gender: event.gender,
      ms_group_id: event.ms_group_id
    })
  }

  async function handleSaveEvent() {
    if (!eventForm.meet_id || !eventForm.event_numb || !eventForm.ms_race_id) {
      alert('Please fill in all required fields')
      return
    }

    try {
      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update({
            ms_race_id: eventForm.ms_race_id,
            gender: eventForm.gender,
            ms_group_id: eventForm.ms_group_id,
            event_numb: eventForm.event_numb
          })
          .eq('ms_id', editingEvent.ms_id)

        if (error) throw error
      } else {
        // Create new event
        const { error } = await supabase
          .from('events')
          .insert([{
            meet_id: eventForm.meet_id,
            event_numb: eventForm.event_numb,
            ms_race_id: eventForm.ms_race_id,
            gender: eventForm.gender,
            ms_group_id: eventForm.ms_group_id
          }])

        if (error) throw error
      }

      // Refresh events list
      if (selectedMeet) {
        await handleViewEvents(selectedMeet)
      }
      
      setEditingEvent(null)
      setCreatingEvent(false)
      // Don't reset eventForm - keep the selections for next event
    } catch (error) {
      alert('Failed to save event')
    }
  }

  async function handleDeleteEvent(event: EventWithRace) {
    if (!confirm(`Are you sure you want to delete Event #${event.event_numb}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('ms_id', event.ms_id)

      if (error) throw error

      // Refresh events list
      if (selectedMeet) {
        await handleViewEvents(selectedMeet)
      }
    } catch (error) {
      alert('Failed to delete event')
    }
  }

  function closeEventsView() {
    setViewingEvents(false)
    setMeetEvents([])
    setAvailableRaces([])
    setEditingEvent(null)
    setCreatingEvent(false)
    setEventForm({})
    setRaceTypeFilter('IND')
    setSelectedMeet(null)
  }

  async function handleAddEntriesForEvent(event: EventWithRace) {
    // Check if this is a relay event
    if (event.race && event.race.relay_count > 1) {
      // Open relay modal
      setAddingRelayEntriesForEvent(event)
      return
    }
    
    // Open individual entries modal
    setAddingEntriesForEvent(event)
    setLoadingEventAthletes(true)
    setSelectedAthletes(new Set())
    
    try {
      if (!selectedSeason || !selectedMeet) return

      // Fetch existing results/entries for this event
      const { data: existingResults, error: resultsError } = await supabase
        .from('results')
        .select('fincode')
        .eq('meet_id', selectedMeet.meet_id)
        .eq('event_numb', event.event_numb)

      if (resultsError) {
      }

      // Fetch eligible athletes with personal bests using SQL function
      const { data: athletesData, error: athletesError } = await supabase
        .rpc('get_eligible_athletes_for_event', {
          p_season_id: selectedSeason.season_id,
          p_event_gender: event.gender,
          p_event_group_id: event.ms_group_id,
          p_race_id: event.ms_race_id,
          p_meet_course: selectedMeet.meet_course
        })

      if (athletesError) {
        throw athletesError
      }

      // Map to the expected format
      const athletesWithPB = (athletesData || []).map((athlete: any) => ({
        fincode: athlete.fincode,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        gender: athlete.gender,
        group_id: athlete.group_id,
        personalBest: athlete.personal_best,
        formattedPersonalBest: athlete.pb_string
      }))

      setEventAthletes(athletesWithPB)

      // Pre-select athletes who already have entries
      if (existingResults && existingResults.length > 0) {
        const existingFincodes = new Set(existingResults.map(r => r.fincode))
        setSelectedAthletes(existingFincodes)
        setOriginalEntries(existingFincodes)
      } else {
        setOriginalEntries(new Set())
      }
    } catch (error) {
    } finally {
      setLoadingEventAthletes(false)
    }
  }

  function toggleAthleteSelection(fincode: number) {
    const newSelected = new Set(selectedAthletes)
    if (newSelected.has(fincode)) {
      newSelected.delete(fincode)
    } else {
      newSelected.add(fincode)
    }
    setSelectedAthletes(newSelected)
  }

  async function handleSaveEventEntries() {
    if (!selectedMeet || !addingEntriesForEvent) {
      return
    }

    setSavingEventEntries(true)
    
    try {
      // Determine which athletes to add and which to remove
      const toAdd = [...selectedAthletes].filter(fc => !originalEntries.has(fc))
      const toRemove = [...originalEntries].filter(fc => !selectedAthletes.has(fc))
      
      let addedCount = 0
      let removedCount = 0

      // Delete entries for unselected athletes
      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('results')
          .delete()
          .eq('meet_id', selectedMeet.meet_id)
          .eq('event_numb', addingEntriesForEvent.event_numb)
          .in('fincode', toRemove)

        if (deleteError) throw deleteError
        removedCount = toRemove.length
      }

      // Insert entries for newly selected athletes
      if (toAdd.length > 0) {
        const entriesToInsert = toAdd.map(fincode => {
          const athlete = eventAthletes.find(a => a.fincode === fincode)
          return {
            fincode,
            meet_id: selectedMeet.meet_id,
            event_numb: addingEntriesForEvent.event_numb,
            res_time_decimal: 0,
            entry_time_decimal: athlete?.personalBest || 0
          }
        })

        const { error: insertError } = await supabase
          .from('results')
          .insert(entriesToInsert)

        if (insertError) throw insertError
        addedCount = toAdd.length
      }

      // Show summary message
      const messages = []
      if (addedCount > 0) messages.push(`Added ${addedCount} ${addedCount === 1 ? 'entry' : 'entries'}`)
      if (removedCount > 0) messages.push(`Removed ${removedCount} ${removedCount === 1 ? 'entry' : 'entries'}`)
      
      if (messages.length > 0) {
        alert(messages.join(', '))
      } else {
        alert('No changes made')
      }
      
      // Refresh entry counts for the events list
      await fetchEventEntryCounts(selectedMeet.meet_id)
      
      // Close modal
      setAddingEntriesForEvent(null)
      setSelectedAthletes(new Set())
      setOriginalEntries(new Set())
      setEventAthletes([])
      
    } catch (error) {
      alert('Failed to save entries')
    } finally {
      setSavingEventEntries(false)
    }
  }

  function closeEventEntriesModal() {
    setAddingEntriesForEvent(null)
    setSelectedAthletes(new Set())
    setEventAthletes([])
  }

  async function fetchEventEntryCounts(meetId: number) {
    try {
      const { data: entriesData, error } = await supabase
        .from('results')
        .select('event_numb')
        .eq('meet_id', meetId)

      if (error) {
        return
      }

      // Count entries per event (individual results)
      const counts = new Map<number, number>()
      entriesData?.forEach(entry => {
        counts.set(entry.event_numb, (counts.get(entry.event_numb) || 0) + 1)
      })

      // Also fetch relay entries
      const { data: relayData, error: relayError } = await supabase
        .from('relay_results')
        .select('event_numb')
        .eq('meet_id', meetId)

      if (!relayError) {
        // Count relay entries per event (each relay entry counts as one team)
        relayData?.forEach(entry => {
          counts.set(entry.event_numb, (counts.get(entry.event_numb) || 0) + 1)
        })
      }

      setEventEntryCounts(counts)
    } catch (error) {
    }
  }

  async function handleEditResult(result: ResultWithAthlete) {
    setEditingResult(result)
    // Don't display 000000 for zero times - leave empty for easier input
    setResultTimeInput(result.res_time_decimal === 0 ? '' : millisecondsToTimeString(result.res_time_decimal))
  }

  async function handleSaveResultTime(timeOverride?: string, statusOverride?: ResultStatus) {
    if (!editingResult) return

    const timeToUse = timeOverride || resultTimeInput
    const statusToUse = statusOverride || 'FINISHED'
    
    // If status is not FINISHED, time should be 0
    const milliseconds = statusToUse !== 'FINISHED' ? 0 : timeStringToMilliseconds(timeToUse)
    
    if (statusToUse === 'FINISHED' && milliseconds === 0 && timeToUse !== '000000') {
      alert('Invalid time format. Please use mmsshh (e.g., 012345 for 1:23.45)')
      return
    }

    try {
      const { error } = await supabase
        .from('results')
        .update({ 
          res_time_decimal: milliseconds,
          result_status: statusToUse
        })
        .eq('res_id', editingResult.res_id)

      if (error) throw error

      // Update local state instead of refetching
      const formattedTime = milliseconds > 0 ? await formatTimeWithSupabase(milliseconds) : ''
      setResults(prevResults => 
        prevResults.map(r => 
          r.res_id === editingResult.res_id 
            ? { ...r, res_time_decimal: milliseconds, result_status: statusToUse, formattedTime }
            : r
        )
      )
      
      setEditingResult(null)
      setResultTimeInput('')
    } catch (error) {
      alert('Failed to update result')
    }
  }

  async function handleDeleteResult(result: ResultWithAthlete) {
    if (!confirm(`Delete result for ${result.athlete?.firstname} ${result.athlete?.lastname}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('res_id', result.res_id)

      if (error) throw error

      // Update local state instead of refetching
      setResults(prevResults => 
        prevResults.filter(r => r.res_id !== result.res_id)
      )
    } catch (error) {
      alert('Failed to delete result')
    }
  }

  async function handleEditRelayResult(relayResult: RelayResultWithEvent) {
    setEditingRelayResult(relayResult)
    // Set initial values for leg times (don't display 000000 for zero times)
    setRelayLegInputs({
      leg1: relayResult.leg1_res_time === 0 ? '' : millisecondsToTimeString(relayResult.leg1_res_time),
      leg2: relayResult.leg2_res_time === 0 ? '' : millisecondsToTimeString(relayResult.leg2_res_time),
      leg3: relayResult.leg3_res_time === 0 ? '' : millisecondsToTimeString(relayResult.leg3_res_time),
      leg4: relayResult.leg4_res_time === 0 ? '' : millisecondsToTimeString(relayResult.leg4_res_time)
    })
  }

  async function handleSaveRelayResult(statusOverride?: ResultStatus) {
    if (!editingRelayResult) return

    const statusToUse = statusOverride || 'FINISHED'
    
    let leg1Time = 0
    let leg2Time = 0
    let leg3Time = 0
    let leg4Time = 0

    // If status is FINISHED, parse the times
    if (statusToUse === 'FINISHED') {
      leg1Time = timeStringToMilliseconds(relayLegInputs.leg1)
      leg2Time = timeStringToMilliseconds(relayLegInputs.leg2)
      leg3Time = timeStringToMilliseconds(relayLegInputs.leg3)
      leg4Time = timeStringToMilliseconds(relayLegInputs.leg4)

      // Validate that all times are present and valid
      if (leg1Time === 0 && relayLegInputs.leg1 !== '000000') {
        alert('Invalid time format for Leg 1. Please use mmsshh (e.g., 012345 for 1:23.45)')
        return
      }
      if (leg2Time === 0 && relayLegInputs.leg2 !== '000000') {
        alert('Invalid time format for Leg 2. Please use mmsshh (e.g., 012345 for 1:23.45)')
        return
      }
      if (leg3Time === 0 && relayLegInputs.leg3 !== '000000') {
        alert('Invalid time format for Leg 3. Please use mmsshh (e.g., 012345 for 1:23.45)')
        return
      }
      if (leg4Time === 0 && relayLegInputs.leg4 !== '000000') {
        alert('Invalid time format for Leg 4. Please use mmsshh (e.g., 012345 for 1:23.45)')
        return
      }
    }

    try {
      const { error } = await supabase
        .from('relay_results')
        .update({ 
          leg1_res_time: leg1Time,
          leg2_res_time: leg2Time,
          leg3_res_time: leg3Time,
          leg4_res_time: leg4Time,
          result_status: statusToUse
        })
        .eq('relay_result_id', editingRelayResult.relay_result_id)

      if (error) throw error

      // Update local state
      const totalTime = leg1Time + leg2Time + leg3Time + leg4Time
      const formattedTime = totalTime > 0 ? await formatTimeWithSupabase(totalTime) : ''
      
      setRelayResults(prevResults => 
        prevResults.map(r => 
          r.relay_result_id === editingRelayResult.relay_result_id 
            ? { 
                ...r, 
                leg1_res_time: leg1Time,
                leg2_res_time: leg2Time,
                leg3_res_time: leg3Time,
                leg4_res_time: leg4Time,
                result_status: statusToUse,
                totalTime: totalTime,
                formattedTime: formattedTime
              }
            : r
        )
      )
      
      setEditingRelayResult(null)
      setRelayLegInputs({ leg1: '', leg2: '', leg3: '', leg4: '' })
    } catch (error) {
      alert('Failed to update relay result')
    }
  }

  async function handleDeleteRelayResult(relayResult: RelayResultWithEvent) {
    if (!confirm(`Delete relay result for ${relayResult.relay_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('relay_results')
        .delete()
        .eq('relay_result_id', relayResult.relay_result_id)

      if (error) throw error

      // Update local state
      setRelayResults(prevResults => 
        prevResults.filter(r => r.relay_result_id !== relayResult.relay_result_id)
      )
    } catch (error) {
      alert('Failed to delete relay result')
    }
  }

  async function handleAddResult(event: EventWithRace) {
    setCreatingResult(event)
    setNewResultForm({ fincode: 0, timeInput: '' })
    
    try {
      if (!selectedSeason || !selectedMeet) return

      // Fetch eligible athletes for this event
      const { data: athletesData, error: athletesError } = await supabase
        .rpc('get_eligible_athletes_for_event', {
          p_season_id: selectedSeason.season_id,
          p_event_gender: event.gender,
          p_event_group_id: event.ms_group_id,
          p_race_id: event.ms_race_id,
          p_meet_course: selectedMeet.meet_course
        })

      if (athletesError) throw athletesError

      setAvailableAthletesForResult(athletesData || [])
    } catch (error) {
    }
  }

  async function handleSaveNewResult(timeOverride?: string, statusOverride?: ResultStatus) {
    if (!creatingResult || !selectedMeet || !newResultForm.fincode) {
      alert('Please select an athlete')
      return
    }

    const timeToUse = timeOverride || newResultForm.timeInput
    const statusToUse = statusOverride || 'FINISHED'
    
    // If status is not FINISHED, time should be 0
    const milliseconds = statusToUse !== 'FINISHED' ? 0 : timeStringToMilliseconds(timeToUse)
    
    if (statusToUse === 'FINISHED' && milliseconds === 0 && timeToUse !== '000000') {
      alert('Invalid time format. Please use mmsshh (e.g., 012345 for 1:23.45)')
      return
    }

    try {
      const { data, error } = await supabase
        .from('results')
        .insert([{
          fincode: newResultForm.fincode,
          meet_id: selectedMeet.meet_id,
          event_numb: creatingResult.event_numb,
          res_time_decimal: milliseconds,
          result_status: statusToUse,
          entry_time_decimal: 0
        }])
        .select()

      if (error) throw error

      // Get athlete info and format time
      const athlete = availableAthletesForResult.find(a => a.fincode === newResultForm.fincode)
      const event = events.find(e => e.event_numb === creatingResult.event_numb)
      const formattedTime = milliseconds > 0 ? await formatTimeWithSupabase(milliseconds) : ''
      
      // Add to local state instead of refetching
      if (data && data.length > 0) {
        const newResult: ResultWithAthlete = {
          ...data[0],
          athlete,
          event,
          race: event?.race,
          formattedTime
        }
        setResults(prevResults => [...prevResults, newResult])
      }
      
      setCreatingResult(null)
      setNewResultForm({ fincode: 0, timeInput: '' })
      setAvailableAthletesForResult([])
    } catch (error) {
      alert('Failed to create result')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Meets</h1>
          <p className="text-muted-foreground mt-2">
            Manage swimming meets and competitions
          </p>
        </div>
        <Button onClick={handleAddNewMeet}>
          <Plus className="mr-2 h-4 w-4" />
          Add Meet
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search meets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading meets...</div>
      ) : filteredMeets.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No meets found</p>
              <p className="text-sm">
                {searchTerm
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first meet'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeets.map((meet) => (
            <div 
              key={meet.meet_id}
              className="cursor-pointer"
              onClick={() => {
                setSelectedMeet(meet)
                fetchMeetStats(meet)
              }}
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <CardTitle>{meet.meet_name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {meet.place}, {meet.nation}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(meet.min_date).toLocaleDateString()}
                      {meet.max_date !== meet.min_date && 
                        ` - ${new Date(meet.max_date).toLocaleDateString()}`}
                    </div>
                    <p className="text-muted-foreground">
                      Pool: {meet.pool_name} ({getCourseLength(meet.meet_course)})
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Meet Detail Modal */}
      {selectedMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMeet(null)}>
          <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{selectedMeet.meet_name}</CardTitle>
                <Button variant="ghost" onClick={() => setSelectedMeet(null)}>✕</Button>
              </div>
              <CardDescription>Meet ID: {selectedMeet.meet_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{selectedMeet.place}, {selectedMeet.nation}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Pool</p>
                  <p className="text-sm text-muted-foreground">{selectedMeet.pool_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Course</p>
                  <p className="text-sm text-muted-foreground">{getCourseLength(selectedMeet.meet_course)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Date Range</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedMeet.min_date).toLocaleDateString()} - {new Date(selectedMeet.max_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Events</p>
                  <p className="text-sm text-muted-foreground">{meetStats.eventsCount}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Entries</p>
                  <p className="text-sm text-muted-foreground">{meetStats.entriesCount}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Results</p>
                  <p className="text-sm text-muted-foreground">{meetStats.resultsCount}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  size="sm"
                  onClick={() => handleEditMeet(selectedMeet)}
                >
                  Edit
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="bg-purple-50 hover:bg-purple-100 border-purple-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewResults(selectedMeet)
                  }}
                >
                  Results
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  className="bg-green-50 hover:bg-green-100 border-green-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewEvents(selectedMeet)
                  }}
                >
                  Events
                </Button>
                <Button size="sm" variant="destructive">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results View Modal */}
      {viewingResults && selectedMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={closeResultsView}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <CardTitle className="text-2xl">Results - {selectedMeet.meet_name}</CardTitle>
                    <CardDescription>
                      Events: {meetStats.eventsCount} • Entries: {meetStats.entriesCount} • Results: {meetStats.resultsCount}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" onClick={closeResultsView}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {loadingResults ? (
                <div className="text-center py-12">Loading results...</div>
              ) : results.length === 0 && relayResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No results found for this meet
                </div>
              ) : (
                <div className="space-y-6">
                  {events
                    .sort((a, b) => a.event_numb - b.event_numb)
                    .map((event) => {
                    const isRelayEvent = event.race && event.race.relay_count > 1
                    const eventResults = results.filter(r => r.event_numb === event.event_numb)
                    const eventRelayResults = relayResults.filter(r => r.event_numb === event.event_numb)
                    if (eventResults.length === 0 && eventRelayResults.length === 0) return null
                    
                    const race = event.race
                    const raceName = race 
                      ? race.relay_count > 1 
                        ? `${race.relay_count}x${race.distance}m ${race.stroke_long_en}` 
                        : `${race.distance}m ${race.stroke_long_en}` 
                      : `Event ${event.event_numb}`
                    
                    return (
                      <div key={event.ms_id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <Trophy className="h-5 w-5 text-primary" />
                              Event #{event.event_numb} - {raceName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {event.gender} • {event.group?.group_name || 'Unknown'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddResult(event)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {isRelayEvent ? eventRelayResults.length : eventResults.length} {(isRelayEvent ? eventRelayResults.length : eventResults.length) === 1 ? 'result' : 'results'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {isRelayEvent ? (
                            // Relay Results Display
                            eventRelayResults
                              .sort((a, b) => {
                                const aFinished = !a.result_status || a.result_status === 'FINISHED'
                                const bFinished = !b.result_status || b.result_status === 'FINISHED'
                                
                                if (aFinished && !bFinished) return -1
                                if (!aFinished && bFinished) return 1
                                
                                if (aFinished && bFinished) {
                                  return (a.totalTime || 0) - (b.totalTime || 0)
                                }
                                
                                return (a.result_status || '').localeCompare(b.result_status || '')
                              })
                              .map((relayResult, idx) => (
                                <div
                                  key={relayResult.relay_result_id}
                                  className="flex items-center justify-between p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                                >
                                  <div 
                                    className="flex items-center gap-3 flex-1 cursor-pointer"
                                    onClick={() => handleViewRelaySplits(relayResult)}
                                  >
                                    <span className="text-sm font-bold text-muted-foreground w-6">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <p className="text-sm font-medium">
                                        {relayResult.relay_name}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Relay
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-base font-bold ${relayResult.result_status !== 'FINISHED' ? 'text-destructive' : 'font-mono'}`}>
                                      {relayResult.result_status === 'FINISHED' 
                                        ? (relayResult.formattedTime || formatTime(relayResult.totalTime || 0))
                                        : relayResult.result_status}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditRelayResult(relayResult)
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteRelayResult(relayResult)
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              ))
                          ) : (
                            // Individual Results Display
                            eventResults
                            .sort((a, b) => {
                              // First, separate by status: FINISHED first, then non-FINISHED
                              const aFinished = !a.result_status || a.result_status === 'FINISHED'
                              const bFinished = !b.result_status || b.result_status === 'FINISHED'
                              
                              if (aFinished && !bFinished) return -1
                              if (!aFinished && bFinished) return 1
                              
                              // Within FINISHED results, sort by time
                              if (aFinished && bFinished) {
                                return a.res_time_decimal - b.res_time_decimal
                              }
                              
                              // Within non-FINISHED results, sort alphabetically by status (DNS, DNF, DSQ)
                              return (a.result_status || '').localeCompare(b.result_status || '')
                            })
                            .map((result, idx) => (
                            <div
                              key={result.res_id}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                            >
                              <div 
                                className="flex items-center gap-3 flex-1 cursor-pointer"
                                onClick={() => handleViewSplits(result)}
                              >
                                <span className="text-sm font-bold text-muted-foreground w-6">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="text-sm font-medium">
                                    {result.athlete?.firstname} {result.athlete?.lastname}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    FIN: {result.fincode}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-base font-bold ${result.result_status !== 'FINISHED' ? 'text-destructive' : 'font-mono'}`}>
                                  {formatResultDisplay(result)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditResult(result)
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteResult(result)
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))
                          )}
                          {!isRelayEvent && eventResults.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              No results yet for this event
                            </div>
                          )}
                          {isRelayEvent && eventRelayResults.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                              No relay results yet for this event
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Event Entries Modal */}
      {addingEntriesForEvent && selectedMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    Add Entries - Event #{addingEntriesForEvent.event_numb}
                  </CardTitle>
                  <CardDescription>
                    {addingEntriesForEvent.race 
                      ? `${addingEntriesForEvent.race.relay_count > 1 
                          ? `${addingEntriesForEvent.race.relay_count}x${addingEntriesForEvent.race.distance}m` 
                          : `${addingEntriesForEvent.race.distance}m`} ${addingEntriesForEvent.race.stroke_long_en}` 
                      : 'Event'} • {addingEntriesForEvent.gender} • {addingEntriesForEvent.group?.group_name || 'Unknown'}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground mt-2">
                    {eventAthletes.length} eligible athletes • {selectedAthletes.size} selected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSaveEventEntries}
                    disabled={savingEventEntries || selectedAthletes.size === 0}
                  >
                    {savingEventEntries ? 'Saving...' : `Add ${selectedAthletes.size} ${selectedAthletes.size === 1 ? 'Entry' : 'Entries'}`}
                  </Button>
                  <Button variant="ghost" onClick={closeEventEntriesModal}>✕</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {loadingEventAthletes ? (
                <div className="text-center py-12">Loading athletes...</div>
              ) : eventAthletes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No eligible athletes found for this event
                </div>
              ) : (
                <div className="space-y-0.5">
                  {eventAthletes.map((athlete) => {
                    const isSelected = selectedAthletes.has(athlete.fincode)
                    
                    return (
                      <div
                        key={athlete.fincode}
                        className={`flex items-center justify-between p-1.5 px-2 rounded border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/10 border-primary' 
                            : 'bg-muted/20 border-transparent hover:bg-muted/40'
                        }`}
                        onClick={() => toggleAthleteSelection(athlete.fincode)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded flex-shrink-0"
                          />
                          <div className="flex items-baseline gap-2 min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {athlete.firstname} {athlete.lastname}
                            </p>
                            <p className="text-xs text-muted-foreground flex-shrink-0">
                              {athlete.fincode}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          {athlete.personalBest ? (
                            <p className="text-sm font-mono font-semibold">
                              {athlete.formattedPersonalBest || formatTime(athlete.personalBest)}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No PB</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Splits View Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">
                    Split Times - {selectedResult.result.athlete?.firstname} {selectedResult.result.athlete?.lastname}
                  </CardTitle>
                  <CardDescription>
                    {selectedResult.result.race 
                      ? `${selectedResult.result.race.distance}m ${selectedResult.result.race.stroke_long_en}` 
                      : 'Event'} • Final Time: {formatTime(selectedResult.result.res_time_decimal)}
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => {
                  setSelectedResult(null)
                  setSplitInputs([])
                  setEditingSplits(false)
                }}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3">
              <div className="space-y-2">
                {splitInputs.map((input, idx) => {
                  // Find the matching split from the database
                  const existingSplit = selectedResult.splits.find(s => s.distance === input.distance)
                  
                  return (
                    <div
                      key={`${input.distance}-${idx}`}
                      className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg"
                    >
                      <span className="text-base font-bold text-primary w-16">
                        {input.distance}m
                      </span>
                      
                      {editingSplits ? (
                        <div className="flex-1">
                          <Input
                            ref={(el) => {
                              if (el) inputRefs.current.set(idx, el)
                            }}
                            value={input.timeInput}
                            onChange={(e) => {
                              // Prevent onChange from doing anything - we handle everything in onKeyDown
                              e.preventDefault()
                            }}
                            onKeyDown={(e) => {
                              const inputEl = inputRefs.current.get(idx)
                              if (!inputEl) return
                              
                              const cursorPos = inputEl.selectionStart || 0
                              
                              if (e.key === 'Backspace') {
                                e.preventDefault()
                                
                                // Convert current display to array
                                const chars = input.timeInput.split('')
                                
                                // Find the digit position to the left of cursor
                                let targetPos = cursorPos - 1
                                
                                // Skip : and . when going backwards
                                while (targetPos >= 0 && (chars[targetPos] === ':' || chars[targetPos] === '.')) {
                                  targetPos--
                                }
                                
                                // Replace digit with underscore
                                if (targetPos >= 0 && (chars[targetPos] === '_' || /[0-9]/.test(chars[targetPos]))) {
                                  chars[targetPos] = '_'
                                  const newFormatted = chars.join('')
                                  
                                  const newInputs = [...splitInputs]
                                  newInputs[idx].timeInput = newFormatted
                                  setSplitInputs(newInputs)
                                  
                                  // Move cursor to the left of the deleted digit
                                  setTimeout(() => {
                                    inputEl.setSelectionRange(targetPos, targetPos)
                                  }, 0)
                                }
                                return
                              }
                              
                              if (e.key === 'Delete') {
                                e.preventDefault()
                                
                                // Convert current display to array
                                const chars = input.timeInput.split('')
                                
                                // Find the digit position at cursor
                                let targetPos = cursorPos
                                
                                // Skip : and . when going forward
                                while (targetPos < chars.length && (chars[targetPos] === ':' || chars[targetPos] === '.')) {
                                  targetPos++
                                }
                                
                                // Replace digit with underscore
                                if (targetPos < chars.length && (chars[targetPos] === '_' || /[0-9]/.test(chars[targetPos]))) {
                                  chars[targetPos] = '_'
                                  const newFormatted = chars.join('')
                                  
                                  const newInputs = [...splitInputs]
                                  newInputs[idx].timeInput = newFormatted
                                  setSplitInputs(newInputs)
                                  
                                  // Keep cursor at same position
                                  setTimeout(() => {
                                    inputEl.setSelectionRange(cursorPos, cursorPos)
                                  }, 0)
                                }
                                return
                              }
                              
                              // Handle digit input
                              if (/^[0-9]$/.test(e.key)) {
                                e.preventDefault()
                                
                                // Convert current display to array
                                const chars = input.timeInput.split('')
                                
                                // Find the digit position at cursor
                                let targetPos = cursorPos
                                
                                // Skip : and . when at those positions
                                while (targetPos < chars.length && (chars[targetPos] === ':' || chars[targetPos] === '.')) {
                                  targetPos++
                                }
                                
                                // Replace digit or underscore at this position
                                if (targetPos < chars.length) {
                                  chars[targetPos] = e.key
                                  const newFormatted = chars.join('')
                                  
                                  const newInputs = [...splitInputs]
                                  newInputs[idx].timeInput = newFormatted
                                  setSplitInputs(newInputs)
                                  
                                  // Move cursor forward past the inserted digit and any separators
                                  setTimeout(() => {
                                    let newCursorPos = targetPos + 1
                                    // Skip over : or . if we land on them
                                    while (newCursorPos < 8 && (newFormatted[newCursorPos] === ':' || newFormatted[newCursorPos] === '.')) {
                                      newCursorPos++
                                    }
                                    inputEl.setSelectionRange(newCursorPos, newCursorPos)
                                  }, 0)
                                }
                                return
                              }
                              
                              // Allow arrow keys and tab
                              if (['ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) {
                                return
                              }
                              
                              // Block all other keys
                              e.preventDefault()
                            }}
                            placeholder="__:__.__"
                            className="font-mono text-base"
                            maxLength={8}
                          />
                        </div>
                      ) : (
                        <span className="text-base font-mono font-medium flex-1">
                          {existingSplit?.formattedTime || input.timeInput !== '__:__.__' ? formattedTimeToDisplay(input.timeInput) : '--:--.--'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {splitInputs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No distance information available for this event
                </div>
              )}
            </CardContent>
            <div className="border-t p-4">
              <div className="flex gap-2">
                {!editingSplits ? (
                  <>
                    <Button 
                      className="flex-1" 
                      onClick={() => setEditingSplits(true)}
                      disabled={splitInputs.length === 0}
                    >
                      Edit Splits
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => {
                        setSelectedResult(null)
                        setSplitInputs([])
                        setEditingSplits(false)
                      }}
                    >
                      Close
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      className="flex-1" 
                      onClick={handleSaveSplits}
                      disabled={savingSplits || splitInputs.length === 0}
                    >
                      {savingSplits ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={() => {
                        setEditingSplits(false)
                        // Reload the splits to reset any unsaved changes
                        handleViewSplits(selectedResult.result)
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Relay Splits View Modal */}
      {selectedRelayResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Relay Splits - {selectedRelayResult.relay_name}</CardTitle>
                  <CardDescription>
                    Total Time: {selectedRelayResult.formattedTime || formatTime(selectedRelayResult.totalTime || 0)}
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedRelayResult(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Leg 1 */}
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Leg 1</h3>
                    <span className="text-lg font-mono font-bold">
                      {formatTime(selectedRelayResult.leg1_res_time)}
                    </span>
                  </div>
                  {selectedRelayResult.leg1_fincode ? (
                    <div>
                      <p className="text-sm font-medium">
                        {relayAthletes.get(selectedRelayResult.leg1_fincode)?.firstname} {relayAthletes.get(selectedRelayResult.leg1_fincode)?.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        FIN: {selectedRelayResult.leg1_fincode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>

                {/* Leg 2 */}
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Leg 2</h3>
                    <span className="text-lg font-mono font-bold">
                      {formatTime(selectedRelayResult.leg2_res_time)}
                    </span>
                  </div>
                  {selectedRelayResult.leg2_fincode ? (
                    <div>
                      <p className="text-sm font-medium">
                        {relayAthletes.get(selectedRelayResult.leg2_fincode)?.firstname} {relayAthletes.get(selectedRelayResult.leg2_fincode)?.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        FIN: {selectedRelayResult.leg2_fincode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>

                {/* Leg 3 */}
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Leg 3</h3>
                    <span className="text-lg font-mono font-bold">
                      {formatTime(selectedRelayResult.leg3_res_time)}
                    </span>
                  </div>
                  {selectedRelayResult.leg3_fincode ? (
                    <div>
                      <p className="text-sm font-medium">
                        {relayAthletes.get(selectedRelayResult.leg3_fincode)?.firstname} {relayAthletes.get(selectedRelayResult.leg3_fincode)?.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        FIN: {selectedRelayResult.leg3_fincode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>

                {/* Leg 4 */}
                <div className="border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Leg 4</h3>
                    <span className="text-lg font-mono font-bold">
                      {formatTime(selectedRelayResult.leg4_res_time)}
                    </span>
                  </div>
                  {selectedRelayResult.leg4_fincode ? (
                    <div>
                      <p className="text-sm font-medium">
                        {relayAthletes.get(selectedRelayResult.leg4_fincode)?.firstname} {relayAthletes.get(selectedRelayResult.leg4_fincode)?.lastname}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        FIN: {selectedRelayResult.leg4_fincode}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not assigned</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setSelectedRelayResult(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Events Modal */}
      {viewingEvents && selectedMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Events - {selectedMeet.meet_name}</CardTitle>
                  <CardDescription>
                    {meetEvents.length} events scheduled • {Array.from(eventEntryCounts.values()).reduce((sum, count) => sum + count, 0)} total entries
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleAddEvent}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                  <Button variant="ghost" onClick={closeEventsView}>✕</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {loadingEvents ? (
                <div className="text-center py-12">Loading events...</div>
              ) : meetEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No events scheduled for this meet</p>
                  <Button onClick={handleAddEvent}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {meetEvents.map((event) => {
                    const race = event.race
                    const raceName = race 
                      ? race.relay_count > 1 
                        ? `${race.relay_count}x${race.distance}m ${race.stroke_long_en}` 
                        : `${race.distance}m ${race.stroke_long_en}` 
                      : 'Unknown Race'
                    const entryCount = eventEntryCounts.get(event.event_numb) || 0
                    
                    return (
                      <div 
                        key={event.ms_id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-primary w-10">
                            #{event.event_numb}
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{raceName}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.gender} • {event.group?.group_name || 'Unknown Group'} • {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-orange-50 hover:bg-orange-100 border-orange-200"
                            onClick={() => handleAddEntriesForEvent(event)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Entries
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditEvent(event)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteEvent(event)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Meet Modal */}
      {creatingMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Add New Meet</CardTitle>
                <Button variant="ghost" onClick={() => setCreatingMeet(false)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Meet Name *</label>
                <Input
                  value={createForm.meet_name || ''}
                  onChange={(e) => setCreateForm({ ...createForm, meet_name: e.target.value })}
                  placeholder="Meet name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Place</label>
                  <Input
                    value={createForm.place || ''}
                    onChange={(e) => setCreateForm({ ...createForm, place: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nation</label>
                  <Input
                    value={createForm.nation || ''}
                    onChange={(e) => setCreateForm({ ...createForm, nation: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Pool Name</label>
                <Input
                  value={createForm.pool_name || ''}
                  onChange={(e) => setCreateForm({ ...createForm, pool_name: e.target.value })}
                  placeholder="Pool name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Course</label>
                <select
                  value={createForm.meet_course || 1}
                  onChange={(e) => setCreateForm({ ...createForm, meet_course: Number(e.target.value) })}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={1}>50m</option>
                  <option value={2}>25m</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <Input
                    type="date"
                    value={createForm.min_date || ''}
                    onChange={(e) => setCreateForm({ ...createForm, min_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date *</label>
                  <Input
                    type="date"
                    value={createForm.max_date || ''}
                    onChange={(e) => setCreateForm({ ...createForm, max_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Participating Groups</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {allGroups.length === 0 ? (
                    <p className="text-sm text-gray-500">No groups available</p>
                  ) : (
                    <div className="space-y-2">
                      {allGroups.map(group => (
                        <label key={group.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.has(group.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedGroupIds)
                              if (e.target.checked) {
                                newSet.add(group.id)
                              } else {
                                newSet.delete(group.id)
                              }
                              setSelectedGroupIds(newSet)
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{group.group_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleCreateMeet}>Create Meet</Button>
                <Button variant="outline" className="flex-1" onClick={() => setCreatingMeet(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Meet Modal */}
      {editingMeet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Edit Meet</CardTitle>
                <Button variant="ghost" onClick={() => setEditingMeet(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Meet Name</label>
                <Input
                  value={editForm.meet_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, meet_name: e.target.value })}
                  placeholder="Meet name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Place</label>
                  <Input
                    value={editForm.place || ''}
                    onChange={(e) => setEditForm({ ...editForm, place: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Nation</label>
                  <Input
                    value={editForm.nation || ''}
                    onChange={(e) => setEditForm({ ...editForm, nation: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Pool Name</label>
                <Input
                  value={editForm.pool_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, pool_name: e.target.value })}
                  placeholder="Pool name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Course</label>
                <select
                  value={editForm.meet_course || 1}
                  onChange={(e) => setEditForm({ ...editForm, meet_course: Number(e.target.value) })}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={1}>50m</option>
                  <option value={2}>25m</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <Input
                    type="date"
                    value={editForm.min_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, min_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <Input
                    type="date"
                    value={editForm.max_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, max_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Participating Groups</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {allGroups.length === 0 ? (
                    <p className="text-sm text-gray-500">No groups available</p>
                  ) : (
                    <div className="space-y-2">
                      {allGroups.map(group => (
                        <label key={group.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.has(group.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedGroupIds)
                              if (e.target.checked) {
                                newSet.add(group.id)
                              } else {
                                newSet.delete(group.id)
                              }
                              setSelectedGroupIds(newSet)
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm">{group.group_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleSaveEdit}>Save Changes</Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditingMeet(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {(creatingEvent || editingEvent) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">
                  {editingEvent ? 'Edit Event' : 'Add New Event'}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setEditingEvent(null)
                    setCreatingEvent(false)
                    setEventForm({})
                  }}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Event Number *</label>
                <Input
                  type="number"
                  value={eventForm.event_numb || ''}
                  onChange={(e) => setEventForm({ ...eventForm, event_numb: Number(e.target.value) })}
                  placeholder="Event number"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Race Category</label>
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={raceTypeFilter === 'IND' ? 'default' : 'outline'}
                    onClick={async () => {
                      setRaceTypeFilter('IND')
                      setLoadingRaces(true)
                      const { data: racesData, error: racesError } = await supabase
                        .from('_races')
                        .select('*')
                        .eq('relay_count', 1)
                        .order('race_id_fin', { ascending: true })
                      if (!racesError) {
                        setAvailableRaces(racesData || [])
                      }
                      setLoadingRaces(false)
                    }}
                    className="flex-1"
                  >
                    Individual
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={raceTypeFilter === 'REL' ? 'default' : 'outline'}
                    onClick={async () => {
                      setRaceTypeFilter('REL')
                      setLoadingRaces(true)
                      const { data: racesData, error: racesError } = await supabase
                        .from('_races')
                        .select('*')
                        .eq('relay_count', 4)
                        .order('race_id_fin', { ascending: true })
                      if (!racesError) {
                        setAvailableRaces(racesData || [])
                      }
                      setLoadingRaces(false)
                    }}
                    className="flex-1"
                  >
                    Relay
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Race Type *</label>
                {loadingRaces ? (
                  <div className="text-sm text-muted-foreground">Loading races...</div>
                ) : (
                  <select
                    value={eventForm.ms_race_id || ''}
                    onChange={(e) => setEventForm({ ...eventForm, ms_race_id: Number(e.target.value) })}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a race type</option>
                    {availableRaces.map((race) => (
                      <option key={race.race_id} value={race.race_id}>
                        {race.relay_count > 1 ? `${race.relay_count}x${race.distance}m` : `${race.distance}m`} {race.stroke_long_en}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Gender *</label>
                  <select
                    value={eventForm.gender || 'M'}
                    onChange={(e) => setEventForm({ ...eventForm, gender: e.target.value })}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="M">Male</option>
                    <option value="W">Women</option>
                    <option value="X">Mixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Group *</label>
                  <select
                    value={eventForm.ms_group_id || ''}
                    onChange={(e) => setEventForm({ ...eventForm, ms_group_id: Number(e.target.value) })}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Select a group</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.group_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Preview</p>
                <p className="text-sm text-muted-foreground">
                  {eventForm.event_numb && `Event #${eventForm.event_numb}`}
                  {eventForm.ms_race_id && availableRaces.find(r => r.race_id === eventForm.ms_race_id) && (() => {
                    const race = availableRaces.find(r => r.race_id === eventForm.ms_race_id)
                    return race ? ` - ${race.relay_count > 1 ? `${race.relay_count}x${race.distance}m` : `${race.distance}m`} ${race.stroke_long_en}` : ''
                  })()}
                  {eventForm.gender && ` (${eventForm.gender})`}
                  {eventForm.ms_group_id && availableGroups.find(g => g.id === eventForm.ms_group_id) && ` - ${availableGroups.find(g => g.id === eventForm.ms_group_id)?.group_name}`}
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleSaveEvent}>
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => {
                    setEditingEvent(null)
                    setCreatingEvent(false)
                    setEventForm({})
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Result Time Modal */}
      {editingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Edit Result Time</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setEditingResult(null)
                  setResultTimeInput('')
                }}>✕</Button>
              </div>
              <CardDescription>
                {editingResult.athlete?.firstname} {editingResult.athlete?.lastname}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Time (mmsshh)</label>
                <Input
                  value={resultTimeInput}
                  onChange={(e) => setResultTimeInput(e.target.value)}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: 6 digits (e.g., 012345 = 1:23.45) - or use status buttons below
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleSaveResultTime()}>
                    Save Time
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingResult(null)
                      setResultTimeInput('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveResultTime('', 'DSQ')}
                  >
                    DSQ
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveResultTime('', 'DNF')}
                  >
                    DNF
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveResultTime('', 'DNS')}
                  >
                    DNS
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Relay Result Modal */}
      {editingRelayResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Edit Relay Times</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setEditingRelayResult(null)
                  setRelayLegInputs({ leg1: '', leg2: '', leg3: '', leg4: '' })
                }}>✕</Button>
              </div>
              <CardDescription>
                {editingRelayResult.relay_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Leg 1 Time (mmsshh)</label>
                <Input
                  value={relayLegInputs.leg1}
                  onChange={(e) => setRelayLegInputs({ ...relayLegInputs, leg1: e.target.value })}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Leg 2 Time (mmsshh)</label>
                <Input
                  value={relayLegInputs.leg2}
                  onChange={(e) => setRelayLegInputs({ ...relayLegInputs, leg2: e.target.value })}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Leg 3 Time (mmsshh)</label>
                <Input
                  value={relayLegInputs.leg3}
                  onChange={(e) => setRelayLegInputs({ ...relayLegInputs, leg3: e.target.value })}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Leg 4 Time (mmsshh)</label>
                <Input
                  value={relayLegInputs.leg4}
                  onChange={(e) => setRelayLegInputs({ ...relayLegInputs, leg4: e.target.value })}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Format: 6 digits (e.g., 012345 = 1:23.45) - or use status buttons below
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleSaveRelayResult()}>
                    Save Times
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEditingRelayResult(null)
                      setRelayLegInputs({ leg1: '', leg2: '', leg3: '', leg4: '' })
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveRelayResult('DSQ')}
                  >
                    DSQ
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveRelayResult('DNF')}
                  >
                    DNF
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveRelayResult('DNS')}
                  >
                    DNS
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Result Modal */}
      {creatingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Add Result</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setCreatingResult(null)
                  setNewResultForm({ fincode: 0, timeInput: '' })
                  setAvailableAthletesForResult([])
                }}>✕</Button>
              </div>
              <CardDescription>
                Event #{creatingResult.event_numb} - {creatingResult.race 
                  ? `${creatingResult.race.relay_count > 1 
                      ? `${creatingResult.race.relay_count}x${creatingResult.race.distance}m` 
                      : `${creatingResult.race.distance}m`} ${creatingResult.race.stroke_long_en}` 
                  : 'Event'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Athlete *</label>
                <select
                  value={newResultForm.fincode || ''}
                  onChange={(e) => setNewResultForm({ ...newResultForm, fincode: Number(e.target.value) })}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select an athlete</option>
                  {availableAthletesForResult.map((athlete) => (
                    <option key={athlete.fincode} value={athlete.fincode}>
                      {athlete.firstname} {athlete.lastname} (FIN: {athlete.fincode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time (mmsshh)</label>
                <Input
                  value={newResultForm.timeInput}
                  onChange={(e) => setNewResultForm({ ...newResultForm, timeInput: e.target.value })}
                  placeholder="012345"
                  maxLength={6}
                  className="font-mono text-lg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: 6 digits (e.g., 012345 = 1:23.45) - or use status buttons below
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleSaveNewResult()}>
                    Add Result
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCreatingResult(null)
                      setNewResultForm({ fincode: 0, timeInput: '' })
                      setAvailableAthletesForResult([])
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveNewResult('', 'DSQ')}
                  >
                    DSQ
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveNewResult('', 'DNF')}
                  >
                    DNF
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1" 
                    onClick={() => handleSaveNewResult('', 'DNS')}
                  >
                    DNS
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Relay Entries Modal */}
      {addingRelayEntriesForEvent && selectedMeet && selectedSeason && (
        <RelayEntriesModal
          event={addingRelayEntriesForEvent}
          meet={selectedMeet}
          seasonId={selectedSeason.season_id}
          onClose={() => setAddingRelayEntriesForEvent(null)}
          onSave={() => {
            // Refresh entry counts
            if (selectedMeet) {
              fetchEventEntryCounts(selectedMeet.meet_id)
            }
          }}
        />
      )}
    </div>
  )
}
