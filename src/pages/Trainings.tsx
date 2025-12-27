import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Calendar, Clock, Waves, MapPin } from 'lucide-react'
import type { Session } from '@/types/database'
import { useSeason } from '@/contexts/SeasonContext'

export function Trainings() {
  const { selectedSeason } = useSeason()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  useEffect(() => {
    if (selectedSeason) {
      fetchSessions()
    }
  }, [selectedSeason])

  async function fetchSessions() {
    if (!selectedSeason) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .gte('date', selectedSeason.season_start)
        .lte('date', selectedSeason.season_end)
        .order('date', { ascending: false })

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = sessions.filter(session =>
    session.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.sector.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Training Sessions</h1>
          <p className="text-muted-foreground mt-2">
            Track training sessions and attendance
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Session
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading sessions...</div>
      ) : filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">No training sessions found</p>
              <p className="text-sm">
                {searchTerm
                  ? 'Try adjusting your search'
                  : 'Get started by adding your first training session'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <div 
              key={session.sess_id}
              className="cursor-pointer"
              onClick={() => setSelectedSession(session)}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-primary" />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {session.type} - {session.sector}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <Waves className="h-3 w-3" />
                            {session.volume}m
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {session.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.location}
                      </span>
                      <span>🏊 {session.pool_name} ({session.sess_course}m)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedSession(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Training Session Details</CardTitle>
                <Button variant="ghost" onClick={() => setSelectedSession(null)}>✕</Button>
              </div>
              <CardDescription>Session ID: {selectedSession.sess_id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Type</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Sector</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.sector}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">{new Date(selectedSession.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.time}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Volume</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.volume} meters</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Course</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.sess_course}m</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.location}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Pool</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.pool_name}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Description</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedSession.description}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1">Edit Session</Button>
                <Button variant="outline" className="flex-1">View Attendance</Button>
                <Button variant="destructive">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
