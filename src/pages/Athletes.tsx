import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Plus, Search, UserCircle, Mail, Calendar } from 'lucide-react'
import type { Athlete } from '@/types/database'
import { useSeason } from '@/contexts/SeasonContext'

interface Group {
  id: number
  group_name: string
}

interface CategoryOption {
  cat_id: number
  cat_name: string
  cat_gender: string
}

interface AthleteDetails extends Athlete {
  season_id: number
  ros_cat_id: number
  cat_name: string
  cat_group_id: number
  group_name: string
}

interface AthleteResultRow {
  race_id: number
  distance: number
  stroke_short_en: string
  meet_name: string
  meet_date: string
  meet_course: number
  res_time_decimal: number
  res_time_str: string
  status: string | number
}

// Function to get athlete photo URL
function getAthletePhotoUrl(fincode: number): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/PortraitPics/${fincode}.jpg`
}

export function Athletes() {
  const { selectedSeason } = useSeason()
  const [athletes, setAthletes] = useState<AthleteDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteDetails | null>(null)
  const [resultsAthlete, setResultsAthlete] = useState<AthleteDetails | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number>(1)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)
  const [athleteResults, setAthleteResults] = useState<AthleteResultRow[]>([])
  const [resultsGroupBy, setResultsGroupBy] = useState<'race' | 'meet'>('race')
  const [formData, setFormData] = useState({
    fincode: 0,
    firstname: '',
    lastname: '',
    birthdate: '',
    gender: 'M',
    email: '',
    phone: '',
    catId: 0
  })

  const handleImageError = (fincode: number) => {
    setImageErrors(prev => new Set(prev).add(fincode))
  }

  useEffect(() => {
    fetchGroups()
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedSeason) {
      fetchAthletes()
    }
  }, [selectedSeason, selectedGroupId])

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

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('_categories')
        .select('cat_id, cat_name, cat_gender')
        .order('cat_id')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  async function fetchRosterCategory(fincode: number): Promise<number | null> {
    if (!selectedSeason) return null

    try {
      const { data, error } = await supabase
        .from('roster')
        .select('ros_cat_id')
        .eq('fincode', fincode)
        .eq('season_id', selectedSeason.season_id)
        .maybeSingle()

      if (error) throw error
      return data?.ros_cat_id ?? null
    } catch (error) {
      console.error('Error fetching roster category:', error)
      return null
    }
  }

  async function fetchAthletes() {
    if (!selectedSeason) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .rpc('get_athletes_details', {
          p_season_id: selectedSeason.season_id,
          p_group_id: selectedGroupId
        })

      if (error) {
        console.error('Error fetching athletes:', error)
        throw error
      }
      
      setAthletes(data || [])
    } catch (error) {
      console.error('Error fetching athletes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAthletes = athletes.filter(athlete =>
    `${athlete.firstname} ${athlete.lastname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (athlete.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  function resetForm() {
    const defaultCatId = categories.find(cat => cat.cat_gender === 'M')?.cat_id || 0
    setFormData({
      fincode: 0,
      firstname: '',
      lastname: '',
      birthdate: '',
      gender: 'M',
      email: '',
      phone: '',
      catId: defaultCatId
    })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    if (name === 'gender') {
      const nextGender = value
      const nextCatId = categories.find(cat => cat.cat_gender === nextGender)?.cat_id || 0
      setFormData(prev => ({
        ...prev,
        gender: nextGender,
        catId: nextCatId
      }))
      return
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'fincode' || name === 'catId' ? Number(value) : value
    }))
  }

  async function openEditMode(athlete: AthleteDetails) {
    const fallbackCatId = categories.find(cat => cat.cat_gender === athlete.gender)?.cat_id || 0
    const rosterCatId = await fetchRosterCategory(athlete.fincode)
    const matchedCatId = rosterCatId || athlete.ros_cat_id || fallbackCatId
    setFormData({
      fincode: athlete.fincode,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      birthdate: athlete.birthdate,
      gender: athlete.gender,
      email: athlete.email || '',
      phone: athlete.phone || '',
      catId: matchedCatId
    })
    setEditMode(true)
    setSelectedAthlete(null)
  }

  async function handleAddAthlete(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSeason) return

    try {
      const { error: athleteError } = await supabase
        .from('athletes')
        .insert([
          {
            fincode: formData.fincode,
            firstname: formData.firstname,
            lastname: formData.lastname,
            birthdate: formData.birthdate,
            gender: formData.gender,
            email: formData.email || null,
            phone: formData.phone || null
          }
        ])

      if (athleteError) throw athleteError

      const { error: rosterError } = await supabase
        .from('roster')
        .insert([
          {
            fincode: formData.fincode,
            season_id: selectedSeason.season_id,
            ros_cat_id: formData.catId || null
          }
        ])

      if (rosterError) throw rosterError

      await fetchAthletes()
      resetForm()
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding athlete:', error)
      alert('Failed to add athlete. Please try again.')
    }
  }

  async function handleUpdateAthlete(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSeason) return

    try {
      const { error: athleteError } = await supabase
        .from('athletes')
        .update({
          firstname: formData.firstname,
          lastname: formData.lastname,
          birthdate: formData.birthdate,
          gender: formData.gender,
          email: formData.email || null,
          phone: formData.phone || null
        })
        .eq('fincode', formData.fincode)

      if (athleteError) throw athleteError

      const { data: rosterData, error: rosterUpdateError } = await supabase
        .from('roster')
        .update({ ros_cat_id: formData.catId || null })
        .eq('fincode', formData.fincode)
        .eq('season_id', selectedSeason.season_id)
        .select()

      if (rosterUpdateError) throw rosterUpdateError

      if (!rosterData || rosterData.length === 0) {
        const { error: rosterInsertError } = await supabase
          .from('roster')
          .insert([
            {
              fincode: formData.fincode,
              season_id: selectedSeason.season_id,
              ros_cat_id: formData.catId || null
            }
          ])

        if (rosterInsertError) throw rosterInsertError
      }

      await fetchAthletes()
      resetForm()
      setEditMode(false)
    } catch (error) {
      console.error('Error updating athlete:', error)
      alert('Failed to update athlete. Please try again.')
    }
  }

  async function handleDeleteAthlete() {
    if (!selectedAthlete) return

    if (!confirm('Are you sure you want to delete this athlete? This action cannot be undone.')) {
      return
    }

    try {
      const { error: rosterError } = await supabase
        .from('roster')
        .delete()
        .eq('fincode', selectedAthlete.fincode)

      if (rosterError) throw rosterError

      const { error: athleteError } = await supabase
        .from('athletes')
        .delete()
        .eq('fincode', selectedAthlete.fincode)

      if (athleteError) throw athleteError

      await fetchAthletes()
      setSelectedAthlete(null)
    } catch (error) {
      console.error('Error deleting athlete:', error)
      alert('Failed to delete athlete. Please try again.')
    }
  }

  function formatTime(decimal: number): string {
    const totalSeconds = decimal / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(2)
    return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds
  }

  function formatResultTime(result: AthleteResultRow): string {
    if (!result.res_time_str) {
      return result.res_time_decimal ? formatTime(result.res_time_decimal) : '-'
    }
    if (typeof result.status === 'string') {
      const status = result.status.toUpperCase()
      if (status !== 'FINISHED' && ['DNS', 'DNF', 'DSQ'].includes(status)) {
        return status
      }
    }
    return result.res_time_str
  }

  async function openResultsModal(athlete: AthleteDetails) {
    if (!selectedSeason) return

    try {
      setResultsAthlete(athlete)
      setResultsLoading(true)
      setResultsError(null)
      setAthleteResults([])
      setSelectedAthlete(null)

      const { data, error } = await supabase
        .rpc('individual_results', {
          p_fincode: athlete.fincode,
          p_season_id: selectedSeason.season_id
        })

      if (error) throw error

      setAthleteResults(data || [])
    } catch (error) {
      console.error('Error fetching athlete results:', error)
      setResultsError('Failed to load results. Please try again.')
    } finally {
      setResultsLoading(false)
    }
  }

  function getGroupedResults() {
    if (resultsGroupBy === 'meet') {
      const meetGroups = athleteResults.reduce((map, result) => {
        const key = `${result.meet_date}|${result.meet_name}`
        const group = map.get(key) || {
          key,
          title: result.meet_name,
          subtitle: result.meet_date,
          results: [] as AthleteResultRow[]
        }
        group.results.push(result)
        map.set(key, group)
        return map
      }, new Map<string, { key: string; title: string; subtitle: string; results: AthleteResultRow[] }>())

      return Array.from(meetGroups.values()).sort((a, b) =>
        new Date(a.subtitle).getTime() - new Date(b.subtitle).getTime()
      )
    }

    const raceGroups = athleteResults.reduce((map, result) => {
      const key = result.race_id
      const group = map.get(key) || {
        key: result.race_id.toString(),
        title: `${result.distance}m ${result.stroke_short_en}`,
        subtitle: '',
        results: [] as AthleteResultRow[]
      }
      group.results.push(result)
      map.set(key, group)
      return map
    }, new Map<number, { key: string; title: string; subtitle: string; results: AthleteResultRow[] }>())

    return Array.from(raceGroups.values())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Athletes</h1>
          <p className="text-muted-foreground mt-2">
            View and manage athlete profiles
          </p>
        </div>
        <Button onClick={() => {
          resetForm()
          setShowAddModal(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Athlete
        </Button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search athletes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-64">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.group_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading athletes...</div>
      ) : filteredAthletes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No athletes found</p>
              <p className="text-sm">
                {searchTerm
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first athlete'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAthletes.map((athlete) => (
            <div 
              key={athlete.fincode}
              className="cursor-pointer"
              onClick={() => setSelectedAthlete(athlete)}
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {imageErrors.has(athlete.fincode) ? (
                      <UserCircle className="h-12 w-12 text-muted-foreground" />
                    ) : (
                      <img
                        src={getAthletePhotoUrl(athlete.fincode)}
                        alt={`${athlete.firstname} ${athlete.lastname}`}
                        className="h-12 w-12 rounded-full object-cover"
                        onError={() => handleImageError(athlete.fincode)}
                      />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        {athlete.firstname} {athlete.lastname}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {athlete.gender === 'M' ? '👨' : '👩'} FIN: {athlete.fincode}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Born: {new Date(athlete.birthdate).toLocaleDateString()}
                  </div>
                  {athlete.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {athlete.email}
                    </div>
                  )}
                  {athlete.phone && (
                    <div className="text-sm text-muted-foreground">
                      📞 {athlete.phone}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Athlete Detail Modal/Panel */}
      {selectedAthlete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedAthlete(null)}>
          <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {imageErrors.has(selectedAthlete.fincode) ? (
                    <UserCircle className="h-20 w-20 text-muted-foreground" />
                  ) : (
                    <img
                      src={getAthletePhotoUrl(selectedAthlete.fincode)}
                      alt={`${selectedAthlete.firstname} ${selectedAthlete.lastname}`}
                      className="h-20 w-20 rounded-full object-cover"
                      onError={() => handleImageError(selectedAthlete.fincode)}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">
                      {selectedAthlete.firstname} {selectedAthlete.lastname}
                    </CardTitle>
                    <Button variant="ghost" onClick={() => setSelectedAthlete(null)}>✕</Button>
                  </div>
                  <CardDescription>FIN Code: {selectedAthlete.fincode}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Gender</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAthlete.gender === 'M' ? 'Male' : 'Female'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Category</p>
                  <p className="text-sm text-muted-foreground">
                    {categories.find(cat => cat.cat_id === selectedAthlete.ros_cat_id)?.cat_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Birth Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedAthlete.birthdate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{selectedAthlete.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{selectedAthlete.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={() => openEditMode(selectedAthlete)}>Edit Athlete</Button>
                <Button variant="outline" className="flex-1" onClick={() => openResultsModal(selectedAthlete)}>View Results</Button>
                <Button variant="destructive" onClick={handleDeleteAthlete}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {resultsAthlete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setResultsAthlete(null)}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Results</CardTitle>
                  <CardDescription>
                    {resultsAthlete.firstname} {resultsAthlete.lastname} · Season {selectedSeason?.season_name}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className={`text-xs ${resultsGroupBy === 'race' ? 'border-green-500 text-green-700' : 'border-yellow-500 text-yellow-700'}`}
                    onClick={() => setResultsGroupBy(prev => (prev === 'race' ? 'meet' : 'race'))}
                  >
                    {resultsGroupBy === 'race' ? 'By race' : 'By meet'}
                  </Button>
                  <Button variant="ghost" onClick={() => setResultsAthlete(null)}>✕</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {resultsLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading results...</div>
              ) : resultsError ? (
                <div className="py-8 text-center text-destructive">{resultsError}</div>
              ) : athleteResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No results found for this season.</div>
              ) : (
                <div className="space-y-4">
                  {getGroupedResults().map((group) => (
                    <div key={group.key} className="border rounded-md p-4">
                      <div className="font-semibold">{group.title}</div>
                      {group.subtitle && (
                        <div className="text-sm text-muted-foreground">{new Date(group.subtitle).toLocaleDateString()}</div>
                      )}
                      <div className="mt-3 space-y-2">
                        {group.results.map((result, index) => (
                          <div
                            key={`${group.key}-${index}`}
                            className={`grid gap-2 text-sm ${resultsGroupBy === 'meet' ? 'sm:grid-cols-[auto,1fr]' : 'sm:grid-cols-[auto,auto,1fr]'} sm:items-center`}
                          >
                            <span className={`font-mono font-medium ${result.meet_course === 1 ? 'text-blue-600' : ''}`}>
                              {formatResultTime(result)}
                            </span>
                            {resultsGroupBy === 'meet' ? (
                              <span className="text-muted-foreground">
                                {result.distance}m {result.stroke_short_en}
                              </span>
                            ) : (
                              <>
                                <span className="text-muted-foreground">{new Date(result.meet_date).toLocaleDateString()}</span>
                                <span className="text-muted-foreground">{result.meet_name}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-right text-sm font-medium text-blue-600">50m pool</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {(showAddModal || editMode) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowAddModal(false)
            setEditMode(false)
            resetForm()
          }}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{editMode ? 'Edit Athlete' : 'Add New Athlete'}</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowAddModal(false)
                  setEditMode(false)
                  resetForm()
                }}>✕</Button>
              </div>
              <CardDescription>{editMode ? 'Update athlete details' : 'Create a new athlete profile'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={editMode ? handleUpdateAthlete : handleAddAthlete} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">FIN Code *</label>
                    <Input
                      type="number"
                      name="fincode"
                      value={formData.fincode || ''}
                      onChange={handleInputChange}
                      disabled={editMode}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Category *</label>
                    <select
                      name="catId"
                      value={formData.catId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      required
                    >
                      {categories
                        .filter((category) => category.cat_gender === formData.gender)
                        .map((category) => (
                        <option key={category.cat_id} value={category.cat_id}>
                          {category.cat_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">First Name *</label>
                    <Input
                      type="text"
                      name="firstname"
                      value={formData.firstname}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Last Name *</label>
                    <Input
                      type="text"
                      name="lastname"
                      value={formData.lastname}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Birth Date *</label>
                    <Input
                      type="date"
                      name="birthdate"
                      value={formData.birthdate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      required
                    >
                      <option value="M">Male</option>
                      <option value="W">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editMode ? 'Update Athlete' : 'Add Athlete'}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => {
                    setShowAddModal(false)
                    setEditMode(false)
                    resetForm()
                  }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
