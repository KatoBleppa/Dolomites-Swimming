import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Plus, Search, UserCircle, Mail, Calendar } from 'lucide-react'
import type { Athlete } from '@/types/database'
import { useSeason } from '@/contexts/SeasonContext'

// Function to get athlete photo URL
function getAthletePhotoUrl(fincode: number): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return `${supabaseUrl}/storage/v1/object/public/PortraitPics/${fincode}.jpg`
}

export function Athletes() {
  const { selectedSeason } = useSeason()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  const handleImageError = (fincode: number) => {
    setImageErrors(prev => new Set(prev).add(fincode))
  }

  useEffect(() => {
    if (selectedSeason) {
      fetchAthletes()
    }
  }, [selectedSeason])

  async function fetchAthletes() {
    if (!selectedSeason) return

    try {
      setLoading(true)
      
      // First get the roster for this season
      const { data: rosterData, error: rosterError } = await supabase
        .from('roster')
        .select('fincode')
        .eq('season_id', selectedSeason.season_id)

      if (rosterError) {
        console.error('Error fetching roster:', rosterError)
        throw rosterError
      }

      const fincodes = rosterData?.map(r => r.fincode) || []

      if (fincodes.length === 0) {
        console.log('No athletes in roster for this season')
        setAthletes([])
        return
      }

      // Then get the athletes for those fincodes
      const { data, error } = await supabase
        .from('athletes')
        .select('*')
        .in('fincode', fincodes)
        .order('lastname', { ascending: true })

      if (error) {
        console.error('Error fetching athletes:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('Athletes fetched successfully:', data?.length, 'records')
      setAthletes(data || [])
    } catch (error) {
      console.error('Error fetching athletes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredAthletes = athletes.filter(athlete =>
    `${athlete.firstname} ${athlete.lastname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    athlete.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Athletes</h1>
          <p className="text-muted-foreground mt-2">
            View and manage athlete profiles
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Athlete
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search athletes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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
                <Button className="flex-1">Edit Athlete</Button>
                <Button variant="outline" className="flex-1">View Results</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
