import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Plus, ChevronLeft, ChevronRight, Waves, Dumbbell } from 'lucide-react'
import type { Session } from '@/types/database'
import { useSeason } from '@/contexts/SeasonContext'

interface Group {
  id: number
  group_name: string
}

export function Trainings() {
  const { selectedSeason } = useSeason()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '18:00',
    type: 'Swim',
    sector: 'Endurance',
    description: '',
    volume: 0,
    location: 'Bolzano',
    pool_name: 'Maso della Pieve',
    sess_course: 25,
    sess_group_id: undefined as number | undefined
  })

  useEffect(() => {
    fetchGroups()
  }, [])

  useEffect(() => {
    if (selectedSeason) {
      fetchSessions()
    }
  }, [selectedSeason])

  async function fetchGroups() {
    try {
      const { data, error } = await supabase
        .from('_groups')
        .select('id, group_name')
        .order('group_name')

      if (error) throw error
      setGroups(data || [])
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  async function fetchSessions() {
    if (!selectedSeason) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          _groups!sessions_sess_group_id_fkey(group_name)
        `)
        .gte('date', selectedSeason.season_start)
        .lte('date', selectedSeason.season_end)
        .order('date', { ascending: true })

      if (error) throw error
      
      // Flatten the nested group_name structure
      const flattenedData = data?.map(session => ({
        ...session,
        group_name: session._groups?.group_name || null,
        _groups: undefined
      })) || []
      
      setSessions(flattenedData)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get calendar data for current month
  function getCalendarDays() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)
    
    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    // Adjust so Monday = 0
    let firstDayOfWeek = firstDay.getDay() - 1
    if (firstDayOfWeek === -1) firstDayOfWeek = 6
    
    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  // Get sessions for a specific date
  function getSessionsForDate(date: Date | null) {
    if (!date) return []
    // Format date locally to avoid timezone conversion issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    return sessions.filter(session => session.date === dateStr)
  }

  // Navigate months
  function previousMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  // Format time to HH:MM
  function formatTime(time: string): string {
    return time.substring(0, 5)
  }

  // Get icon for session type
  function getSessionIcon(type: string) {
    const typeLower = type.toLowerCase()
    if (typeLower.includes('swim') || typeLower.includes('water') || typeLower.includes('pool')) {
      return <Waves className="h-4 w-4 text-blue-600" />
    } else if (typeLower.includes('gym') || typeLower.includes('strength') || typeLower.includes('weight')) {
      return <Dumbbell className="h-4 w-4 text-orange-600" />
    }
    return <Waves className="h-4 w-4 text-primary" />
  }

  // Handle form input changes
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'volume' || name === 'sess_course' ? Number(value) : value
    }))
  }

  // Add new session
  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([formData])
        .select()

      if (error) throw error

      // Add new session to local state
      if (data) {
        setSessions(prev => [...prev, ...data].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ))
      }

      // Reset form and close modal
      resetForm()
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding session:', error)
      alert('Failed to add session. Please try again.')
    }
  }

  // Update existing session
  async function handleUpdateSession(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSession) return
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(formData)
        .eq('sess_id', selectedSession.sess_id)
        .select()

      if (error) throw error

      // Update session in local state
      if (data && data[0]) {
        setSessions(prev => prev.map(s => 
          s.sess_id === selectedSession.sess_id ? data[0] : s
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      }

      // Reset and close
      resetForm()
      setSelectedSession(null)
      setEditMode(false)
    } catch (error) {
      console.error('Error updating session:', error)
      alert('Failed to update session. Please try again.')
    }
  }

  // Delete session
  async function handleDeleteSession() {
    if (!selectedSession) return
    
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return
    }
    
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('sess_id', selectedSession.sess_id)

      if (error) throw error

      // Remove session from local state
      setSessions(prev => prev.filter(s => s.sess_id !== selectedSession.sess_id))
      
      // Close modal
      setSelectedSession(null)
      setEditMode(false)
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session. Please try again.')
    }
  }

  // Reset form to default values
  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: '18:00',
      type: 'Swim',
      sector: 'Endurance',
      description: '',
      volume: 0,
      location: 'Bolzano',
      pool_name: 'Maso della Pieve',
      sess_course: 25,
      sess_group_id: undefined
    })
  }

  // Open edit mode
  function openEditMode(session: Session) {
    setFormData({
      date: session.date,
      time: session.time,
      type: session.type,
      sector: session.sector,
      description: session.description,
      volume: session.volume,
      location: session.location,
      pool_name: session.pool_name,
      sess_course: session.sess_course,
      sess_group_id: session.sess_group_id
    })
    setSelectedSession(session)
    setEditMode(true)
  }

  const calendarDays = getCalendarDays()
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Training Calendar</h1>
          <p className="text-muted-foreground mt-2">
            Monthly view of training sessions
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Session
        </Button>
      </div>

      {/* Calendar Navigation */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-semibold">{monthName}</h2>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="text-center py-12">Loading sessions...</div>
      ) : (
        <Card>
          <CardContent className="p-6">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Week day headers */}
              {weekDays.map(day => (
                <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                const daySessions = day ? getSessionsForDate(day) : []
                const isToday = day && day.toDateString() === new Date().toDateString()
                const isCurrentMonth = day && day.getMonth() === currentDate.getMonth()
                
                return (
                  <div
                    key={index}
                    className={`min-h-[120px] border rounded-lg p-2 ${
                      !day ? 'bg-muted/30' : isCurrentMonth ? 'bg-background' : 'bg-muted/50'
                    } ${isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-2 ${isToday ? 'text-primary font-bold' : ''}`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {daySessions.map(session => (
                            <div
                              key={session.sess_id}
                              className="text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors"
                              onClick={() => setSelectedSession(session)}
                            >
                              <div className="flex items-center gap-1">
                                {getSessionIcon(session.type)}
                                <span className="font-medium">{formatTime(session.time)}</span>
                              </div>
                              {session.group_name && (
                                <div className="text-muted-foreground text-[10px]">
                                  {session.group_name}
                                </div>
                              )}
                              {session.type !== 'Gym' && (
                                <div className="text-muted-foreground">
                                  {session.volume}m
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
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
                {selectedSession.group_name && (
                  <div>
                    <p className="text-sm font-medium">Group</p>
                    <p className="text-sm text-muted-foreground">{selectedSession.group_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Date</p>
                  <p className="text-sm text-muted-foreground">{new Date(selectedSession.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Time</p>
                  <p className="text-sm text-muted-foreground">{formatTime(selectedSession.time)}</p>
                </div>
                {selectedSession.type !== 'Gym' && (
                  <>
                    <div>
                      <p className="text-sm font-medium">Volume</p>
                      <p className="text-sm text-muted-foreground">{selectedSession.volume} meters</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Course</p>
                      <p className="text-sm text-muted-foreground">{selectedSession.sess_course}m</p>
                    </div>
                  </>
                )}
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
                <Button className="flex-1" onClick={() => {
                  openEditMode(selectedSession)
                }}>Edit Session</Button>
                <Button variant="outline" className="flex-1">View Attendance</Button>
                <Button variant="destructive" onClick={handleDeleteSession}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Session Modal */}
      {(showAddModal || editMode) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => {
          setShowAddModal(false)
          setEditMode(false)
          resetForm()
        }}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{editMode ? 'Edit Training Session' : 'Add New Training Session'}</CardTitle>
                <Button variant="ghost" onClick={() => {
                  setShowAddModal(false)
                  setEditMode(false)
                  resetForm()
                }}>✕</Button>
              </div>
              <CardDescription>{editMode ? 'Update training session details' : 'Create a new training session'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={editMode ? handleUpdateSession : handleAddSession} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Date *</label>
                    <Input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Time *</label>
                    <Input
                      type="time"
                      name="time"
                      value={formData.time}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Type *</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                      required
                    >
                      <option value="Swim">Swim</option>
                      <option value="Gym">Gym</option>
                      <option value="Dryland">Dryland</option>
                      <option value="Recovery">Recovery</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Sector *</label>
                    <Input
                      type="text"
                      name="sector"
                      value={formData.sector}
                      onChange={handleInputChange}
                      placeholder="e.g., Senior, Junior, Youth"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Group</label>
                    <select
                      name="sess_group_id"
                      value={formData.sess_group_id || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="">No Group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.group_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.type !== 'Gym' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-2">Volume (meters) *</label>
                        <Input
                          type="number"
                          name="volume"
                          value={formData.volume}
                          onChange={handleInputChange}
                          min="0"
                          step="100"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Course Length *</label>
                        <select
                          name="sess_course"
                          value={formData.sess_course}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          required
                        >
                          <option value="50">50m (Long Course)</option>
                          <option value="25">25m (Short Course)</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">Location *</label>
                    <Input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Bolzano"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Pool Name *</label>
                    <Input
                      type="text"
                      name="pool_name"
                      value={formData.pool_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Lido Bolzano"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px]"
                    placeholder="Training session details, workout description, focus areas, etc."
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editMode ? 'Update Session' : 'Add Session'}
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
