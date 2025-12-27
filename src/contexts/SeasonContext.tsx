import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface Season {
  season_id: number
  season_name: string
  season_start: string
  season_end: string
}

interface SeasonContextType {
  selectedSeason: Season | null
  seasons: Season[]
  setSelectedSeason: (season: Season) => void
  loading: boolean
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined)

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSeasons()
  }, [])

  async function loadSeasons() {
    try {
      const { data, error } = await supabase
        .from('_seasons')
        .select('*')
        .order('season_start', { ascending: false })

      if (error) throw error

      if (data && data.length > 0) {
        setSeasons(data)
        // Set the most recent season as default
        setSelectedSeason(data[0])
      }
    } catch (error) {
      console.error('Error loading seasons:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SeasonContext.Provider value={{ selectedSeason, seasons, setSelectedSeason, loading }}>
      {children}
    </SeasonContext.Provider>
  )
}

export function useSeason() {
  const context = useContext(SeasonContext)
  if (context === undefined) {
    throw new Error('useSeason must be used within a SeasonProvider')
  }
  return context
}
