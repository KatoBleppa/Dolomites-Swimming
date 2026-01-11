import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { Athlete, Meet, Event, Race, RelayResult } from '@/types/database'
import { Edit2, Trash2, Plus } from 'lucide-react'

interface Group {
  id: number
  group_name: string
}

interface EventWithRace extends Event {
  race?: Race
  group?: Group
}

interface RelayLeg {
  legNumber: 1 | 2 | 3 | 4
  fincode: number
  athlete: Athlete | null
  entryTime: number // in milliseconds
  formattedTime: string
  resultTime: number // in milliseconds
  formattedResultTime: string
}

interface RelayResultWithAthletes extends RelayResult {
  athletes?: {
    leg1?: Athlete
    leg2?: Athlete
    leg3?: Athlete
    leg4?: Athlete
  }
}

interface RelayEntriesModalProps {
  event: EventWithRace
  meet: Meet
  seasonId: number
  onClose: () => void
  onSave: () => void
}

export function RelayEntriesModal({ event, meet, seasonId, onClose, onSave }: RelayEntriesModalProps) {
  const [relayName, setRelayName] = useState('')
  const [legs, setLegs] = useState<RelayLeg[]>([
    { legNumber: 1, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
    { legNumber: 2, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
    { legNumber: 3, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
    { legNumber: 4, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' }
  ])
  const [availableAthletes, setAvailableAthletes] = useState<Athlete[]>([])
  const [personalBestsCache, setPersonalBestsCache] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingRelays, setExistingRelays] = useState<RelayResultWithAthletes[]>([])
  const [editingRelayId, setEditingRelayId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    await Promise.all([fetchEligibleAthletes(), fetchExistingRelays()])
  }

  async function fetchEligibleAthletes() {
    setLoading(true)
    try {
      // For relay events, we need to fetch all personal bests for the season/group/course
      // because athletes need PBs for different strokes (back, breast, fly, free)
      const { data: pbData, error: pbError } = await supabase
        .rpc('get_personal_bests', {
          p_season_id: seasonId,
          p_group_id: event.ms_group_id,
          p_course: meet.meet_course
        })

      if (pbError) throw pbError

      // Build personal bests cache for each athlete-race combination
      const pbCache = new Map<string, number>()
      const athleteSet = new Set<number>()
      
      // For each personal best record, store it and track unique athletes
      for (const pb of pbData || []) {
        const key = `${pb.fincode}-${pb.race_id}`
        pbCache.set(key, pb.best_time_decimal)
        athleteSet.add(pb.fincode)
      }
      
      console.log('Personal bests cache built:', pbCache.size, 'entries for', athleteSet.size, 'athletes')
      setPersonalBestsCache(pbCache)

      // Fetch full athlete details for all athletes with PBs
      const { data: athletesData, error: athletesError } = await supabase
        .from('athletes')
        .select('*')
        .in('fincode', Array.from(athleteSet))
        .eq('gender', event.gender)

      if (athletesError) throw athletesError

      setAvailableAthletes(athletesData || [])
    } catch (error) {
      console.error('Error fetching eligible athletes:', error)
      alert('Failed to load eligible athletes')
    } finally {
      setLoading(false)
    }
  }

  async function fetchExistingRelays() {
    try {
      const { data: relaysData, error } = await supabase
        .from('relay_results')
        .select('*')
        .eq('meet_id', meet.meet_id)
        .eq('event_numb', event.event_numb)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Fetch all athletes for the relays
      const allFincodes = new Set<number>()
      relaysData?.forEach(relay => {
        allFincodes.add(relay.leg1_fincode)
        allFincodes.add(relay.leg2_fincode)
        allFincodes.add(relay.leg3_fincode)
        allFincodes.add(relay.leg4_fincode)
      })

      const { data: athletesData, error: athletesError } = await supabase
        .from('athletes')
        .select('*')
        .in('fincode', Array.from(allFincodes))

      if (athletesError) throw athletesError

      const athleteMap = new Map(athletesData?.map(a => [a.fincode, a]) || [])

      const relaysWithAthletes: RelayResultWithAthletes[] = (relaysData || []).map(relay => ({
        ...relay,
        athletes: {
          leg1: athleteMap.get(relay.leg1_fincode),
          leg2: athleteMap.get(relay.leg2_fincode),
          leg3: athleteMap.get(relay.leg3_fincode),
          leg4: athleteMap.get(relay.leg4_fincode)
        }
      }))

      setExistingRelays(relaysWithAthletes)
    } catch (error) {
      console.error('Error fetching existing relays:', error)
    }
  }

  async function handleAthleteChange(legNumber: 1 | 2 | 3 | 4, fincodeStr: string) {
    const fincodeNum = parseInt(fincodeStr)
    
    if (isNaN(fincodeNum) || fincodeNum <= 0) {
      // Clear this leg if invalid or empty selection
      setLegs(prev => prev.map(leg => 
        leg.legNumber === legNumber 
          ? { ...leg, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' }
          : leg
      ))
      return
    }

    // Find the athlete
    const athlete = availableAthletes.find(a => a.fincode === fincodeNum)
    if (!athlete) {
      return
    }

    // Get personal best for this athlete based on the stroke for this leg
    const raceId = getRaceIdForLeg(legNumber)
    const pbKey = `${fincodeNum}-${raceId}`
    const personalBest = personalBestsCache.get(pbKey) || 0
    
    console.log('Personal best from cache:', { fincodeNum, legNumber, raceId, personalBest })
    
    // Update this leg
    setLegs(prev => prev.map(leg => 
      leg.legNumber === legNumber 
        ? { 
            ...leg, 
            fincode: fincodeNum, 
            athlete,
            entryTime: personalBest,
            formattedTime: millisecondsToTimeString(personalBest)
          }
        : leg
    ))
  }

  // Determine the stroke for a specific leg in the relay
  function getStrokeForLeg(legNumber: 1 | 2 | 3 | 4): string {
    if (!event.race) return 'Freestyle'
    
    const strokeLower = event.race.stroke_long_en.toLowerCase()
    
    // Check if it's a medley relay
    if (strokeLower.includes('medley')) {
      // Medley order: Back, Breast, Fly, Free
      switch (legNumber) {
        case 1: return 'Backstroke'
        case 2: return 'Breaststroke'
        case 3: return 'Butterfly'
        case 4: return 'Freestyle'
        default: return 'Freestyle'
      }
    } else {
      // For non-medley relays (e.g., Freestyle relay), all legs are the same stroke
      return event.race.stroke_long_en
    }
  }

  // Get the race_id for a specific stroke and distance
  function getRaceIdForLeg(legNumber: 1 | 2 | 3 | 4): number | null {
    if (!event.race) return null
    
    const distance = event.race.distance
    const strokeForLeg = getStrokeForLeg(legNumber)
    const strokeLower = strokeForLeg.toLowerCase()
    
    // Map stroke and distance to race_id
    if (strokeLower.includes('free')) {
      if (distance === 50) return 2
      if (distance === 100) return 3
      if (distance === 200) return 4
    } else if (strokeLower.includes('back')) {
      if (distance === 50) return 17
      if (distance === 100) return 18
    } else if (strokeLower.includes('breast')) {
      if (distance === 50) return 21
      if (distance === 100) return 22
    } else if (strokeLower.includes('fly') || strokeLower.includes('butter')) {
      if (distance === 50) return 25
      if (distance === 100) return 26
    }
    
    return null
  }

  function millisecondsToTimeString(ms: number): string {
    if (ms === 0) return ''
    const totalSeconds = ms / 1000.0
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const centiseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100)
    
    const result = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
    console.log('Time conversion:', { ms, totalSeconds, minutes, seconds, centiseconds, result })
    return result
  }

  function timeStringToMilliseconds(timeStr: string): number {
    // Remove any non-digit characters and pad with zeros if needed
    const cleaned = timeStr.replace(/\D/g, '')
    if (cleaned.length !== 6) return 0
    
    const minutes = parseInt(cleaned.substring(0, 2), 10)
    const seconds = parseInt(cleaned.substring(2, 4), 10)
    const centiseconds = parseInt(cleaned.substring(4, 6), 10)
    
    return (minutes * 60 * 1000) + (seconds * 1000) + (centiseconds * 10)
  }

  function handleTimeChange(legNumber: 1 | 2 | 3 | 4, timeInput: string) {
    const timeMs = timeStringToMilliseconds(timeInput)
    
    setLegs(prev => prev.map(leg => 
      leg.legNumber === legNumber 
        ? { ...leg, entryTime: timeMs, formattedTime: timeInput }
        : leg
    ))
  }

  function handleResultTimeChange(legNumber: 1 | 2 | 3 | 4, timeInput: string) {
    const timeMs = timeStringToMilliseconds(timeInput)
    
    setLegs(prev => prev.map(leg => 
      leg.legNumber === legNumber 
        ? { ...leg, resultTime: timeMs, formattedResultTime: timeInput }
        : leg
    ))
  }

  async function handleSave() {
    // Validation
    if (!relayName.trim()) {
      alert('Please enter a relay name')
      return
    }

    // Check all 4 athletes are selected
    const invalidLegs = legs.filter(leg => leg.fincode === 0 || !leg.athlete)
    if (invalidLegs.length > 0) {
      alert('Please select all 4 athletes for the relay')
      return
    }

    // Check for duplicate athletes
    const fincodes = legs.map(leg => leg.fincode)
    const uniqueFincodes = new Set(fincodes)
    if (uniqueFincodes.size !== 4) {
      alert('Each athlete can only appear once in the relay')
      return
    }

    setSaving(true)
    try {
      const relayEntry = {
        meet_id: meet.meet_id,
        event_numb: event.event_numb,
        relay_name: relayName.trim(),
        leg1_fincode: legs[0].fincode,
        leg1_entry_time: legs[0].entryTime,
        leg1_res_time: legs[0].resultTime,
        leg2_fincode: legs[1].fincode,
        leg2_entry_time: legs[1].entryTime,
        leg2_res_time: legs[1].resultTime,
        leg3_fincode: legs[2].fincode,
        leg3_entry_time: legs[2].entryTime,
        leg3_res_time: legs[2].resultTime,
        leg4_fincode: legs[3].fincode,
        leg4_entry_time: legs[3].entryTime,
        leg4_res_time: legs[3].resultTime
      }

      if (editingRelayId) {
        // Update existing relay
        const { error } = await supabase
          .from('relay_results')
          .update(relayEntry)
          .eq('relay_result_id', editingRelayId)

        if (error) throw error
        alert('Relay updated successfully!')
      } else {
        // Insert new relay
        const { error } = await supabase
          .from('relay_results')
          .insert(relayEntry)

        if (error) throw error
        alert('Relay entry saved successfully!')
      }

      await fetchExistingRelays()
      resetForm()
      onSave()
    } catch (error) {
      console.error('Error saving relay entry:', error)
      alert('Failed to save relay entry')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setRelayName('')
    setLegs([
      { legNumber: 1, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
      { legNumber: 2, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
      { legNumber: 3, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' },
      { legNumber: 4, fincode: 0, athlete: null, entryTime: 0, formattedTime: '', resultTime: 0, formattedResultTime: '' }
    ])
    setEditingRelayId(null)
    setShowForm(false)
  }

  async function handleEdit(relay: RelayResultWithAthletes) {
    setEditingRelayId(relay.relay_result_id)
    setRelayName(relay.relay_name)
    
    const newLegs: RelayLeg[] = [
      { 
        legNumber: 1, 
        fincode: relay.leg1_fincode, 
        athlete: relay.athletes?.leg1 || null, 
        entryTime: relay.leg1_entry_time, 
        formattedTime: millisecondsToTimeString(relay.leg1_entry_time),
        resultTime: relay.leg1_res_time || 0,
        formattedResultTime: relay.leg1_res_time ? millisecondsToTimeString(relay.leg1_res_time) : ''
      },
      { 
        legNumber: 2, 
        fincode: relay.leg2_fincode, 
        athlete: relay.athletes?.leg2 || null, 
        entryTime: relay.leg2_entry_time, 
        formattedTime: millisecondsToTimeString(relay.leg2_entry_time),
        resultTime: relay.leg2_res_time || 0,
        formattedResultTime: relay.leg2_res_time ? millisecondsToTimeString(relay.leg2_res_time) : ''
      },
      { 
        legNumber: 3, 
        fincode: relay.leg3_fincode, 
        athlete: relay.athletes?.leg3 || null, 
        entryTime: relay.leg3_entry_time, 
        formattedTime: millisecondsToTimeString(relay.leg3_entry_time),
        resultTime: relay.leg3_res_time || 0,
        formattedResultTime: relay.leg3_res_time ? millisecondsToTimeString(relay.leg3_res_time) : ''
      },
      { 
        legNumber: 4, 
        fincode: relay.leg4_fincode, 
        athlete: relay.athletes?.leg4 || null, 
        entryTime: relay.leg4_entry_time, 
        formattedTime: millisecondsToTimeString(relay.leg4_entry_time),
        resultTime: relay.leg4_res_time || 0,
        formattedResultTime: relay.leg4_res_time ? millisecondsToTimeString(relay.leg4_res_time) : ''
      }
    ]
    
    setLegs(newLegs)
    setShowForm(true)
  }

  async function handleDelete(relayId: number, relayName: string) {
    if (!confirm(`Are you sure you want to delete "${relayName}"?`)) {
      return
    }

    setDeleting(relayId)
    try {
      const { error } = await supabase
        .from('relay_results')
        .delete()
        .eq('relay_result_id', relayId)

      if (error) throw error

      alert('Relay deleted successfully!')
      await fetchExistingRelays()
      onSave()
    } catch (error) {
      console.error('Error deleting relay:', error)
      alert('Failed to delete relay')
    } finally {
      setDeleting(null)
    }
  }

  const isFormValid = relayName.trim() && legs.every(leg => leg.fincode > 0 && leg.athlete)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                Relay Entries - Event #{event.event_numb}
              </CardTitle>
              <CardDescription>
                {event.race 
                  ? `${event.race.relay_count}x${event.race.distance}m ${event.race.stroke_long_en}` 
                  : 'Relay Event'} • {event.gender} • {event.group?.group_name || 'Unknown'}
              </CardDescription>
            </div>
            <Button variant="ghost" onClick={onClose}>✕</Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Existing Relays List */}
              {existingRelays.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Existing Relays ({existingRelays.length})</h3>
                    {!showForm && (
                      <Button onClick={() => setShowForm(true)} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add New Relay
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {existingRelays.map((relay) => (
                      <div key={relay.relay_result_id} className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-baseline gap-3 mb-2">
                              <h4 className="font-semibold text-base">{relay.relay_name}</h4>
                              <span className="text-sm font-mono text-muted-foreground">
                                Entry: {millisecondsToTimeString(
                                  relay.leg1_entry_time + relay.leg2_entry_time + relay.leg3_entry_time + relay.leg4_entry_time
                                )}
                              </span>
                              {(() => {
                                const totalResult = (relay.leg1_res_time || 0) + (relay.leg2_res_time || 0) + (relay.leg3_res_time || 0) + (relay.leg4_res_time || 0)
                                return totalResult > 0 && (
                                  <span className="text-sm font-mono font-semibold text-primary">
                                    Result: {millisecondsToTimeString(totalResult)}
                                  </span>
                                )
                              })()}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {[1, 2, 3, 4].map(legNum => {
                                const athlete = relay.athletes?.[`leg${legNum}` as keyof typeof relay.athletes]
                                const entryTime = relay[`leg${legNum}_entry_time` as keyof RelayResult] as number
                                const resultTime = relay[`leg${legNum}_res_time` as keyof RelayResult] as number
                                return (
                                  <div key={legNum} className="flex items-center gap-2">
                                    <span className="text-muted-foreground font-medium">Leg {legNum}:</span>
                                    <span>
                                      {athlete ? `${athlete.firstname} ${athlete.lastname}` : 'Unknown'}
                                      {entryTime > 0 && (
                                        <span className="text-muted-foreground ml-2 font-mono text-xs">
                                          ({millisecondsToTimeString(entryTime)})
                                        </span>
                                      )}
                                      {resultTime > 0 && (
                                        <span className="text-primary ml-2 font-mono text-xs font-semibold">
                                          → {millisecondsToTimeString(resultTime)}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(relay)}
                              disabled={deleting === relay.relay_result_id}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(relay.relay_result_id, relay.relay_name)}
                              disabled={deleting === relay.relay_result_id}
                            >
                              {deleting === relay.relay_result_id ? '...' : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add/Edit Relay Form */}
              {(showForm || existingRelays.length === 0) && (
                <div className="border rounded-lg p-4 bg-background">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {editingRelayId ? 'Edit Relay' : 'Add New Relay'}
                    </h3>
                    {existingRelays.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetForm}>
                        Cancel
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Relay Name */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Relay Name *
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g., Team A, Relay 1"
                        value={relayName}
                        onChange={(e) => setRelayName(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Total Relay Times */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Total Entry Time
                        </label>
                        <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 items-center font-mono text-base">
                          {(() => {
                            const totalTime = legs.reduce((sum, leg) => sum + leg.entryTime, 0)
                            return totalTime > 0 ? millisecondsToTimeString(totalTime) : '--:--.--'
                          })()}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Total Result Time
                        </label>
                        <div className="flex h-9 w-full rounded-md border border-input bg-primary/10 px-3 py-1 items-center font-mono text-base font-semibold text-primary">
                          {(() => {
                            const totalTime = legs.reduce((sum, leg) => sum + leg.resultTime, 0)
                            return totalTime > 0 ? millisecondsToTimeString(totalTime) : '--:--.--'
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Athletes */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Relay Team (4 Athletes)</h4>
                      
                      {legs.map((leg) => (
                        <div key={leg.legNumber} className="border rounded-lg p-3 space-y-2">
                          <h5 className="font-medium text-xs text-muted-foreground">Leg {leg.legNumber}</h5>
                          
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Select Athlete *
                              </label>
                              <select
                                value={leg.fincode || ''}
                                onChange={(e) => handleAthleteChange(leg.legNumber, e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">-- Select Athlete --</option>
                                {availableAthletes.map(athlete => (
                                  <option key={athlete.fincode} value={athlete.fincode}>
                                    {athlete.firstname} {athlete.lastname} (FIN: {athlete.fincode})
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium mb-1">
                                Entry Time (mmsshh)
                              </label>
                              <Input
                                type="text"
                                placeholder="e.g., 013245"
                                value={leg.formattedTime}
                                onChange={(e) => handleTimeChange(leg.legNumber, e.target.value)}
                                disabled={!leg.athlete}
                                className="h-9 font-mono text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium mb-1 text-primary">
                                Result Time (mmsshh)
                              </label>
                              <Input
                                type="text"
                                placeholder="e.g., 013245"
                                value={leg.formattedResultTime}
                                onChange={(e) => handleResultTimeChange(leg.legNumber, e.target.value)}
                                disabled={!leg.athlete}
                                className="h-9 font-mono text-sm border-primary/50 focus-visible:ring-primary"
                              />
                            </div>
                          </div>

                          {leg.athlete && leg.entryTime > 0 && (
                            <div className="text-xs text-muted-foreground">
                              PB: {millisecondsToTimeString(leg.entryTime)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Save Button for Form */}
                    <div className="flex justify-end gap-2 pt-2">
                      {existingRelays.length > 0 && (
                        <Button variant="outline" onClick={resetForm} disabled={saving}>
                          Cancel
                        </Button>
                      )}
                      <Button onClick={handleSave} disabled={!isFormValid || saving}>
                        {saving ? 'Saving...' : editingRelayId ? 'Update Relay' : 'Save Relay'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
