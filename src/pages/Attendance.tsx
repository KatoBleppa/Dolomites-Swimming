import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Calendar, Check, X, Clock, ShieldCheck, Waves, Dumbbell, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import type { Session } from '@/types/database'

interface Athlete {
  fincode: number
  firstname: string
  lastname: string
  gender: string
  attendance_status?: number
  att_id?: number
  season_id?: number
  ros_cat_id?: number
  cat_name?: string
  cat_group_id?: number
  group_name?: string
}

interface AttendanceSession extends Session {
  group_name?: string
}

export function Attendance() {
  const { selectedSeason } = useSeason()
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  useEffect(() => {
    if (selectedSeason) {
      fetchSessions()
    }
  }, [selectedSeason])

  useEffect(() => {
    if (selectedSession) {
      fetchEligibleAthletes(selectedSession)
    }
  }, [selectedSession])

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
        .order('date', { ascending: false })

      if (error) throw error
      
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

  async function fetchEligibleAthletes(session: AttendanceSession) {
    if (!selectedSeason) return

    try {
      setLoading(true)
      
      let athleteData: Athlete[] = []

      // If no group is assigned, fetch all athletes in the season
      if (!session.sess_group_id) {
        const { data: rosterData, error: rosterError } = await supabase
          .from('roster')
          .select('fincode')
          .eq('season_id', selectedSeason.season_id)

        if (rosterError) throw rosterError

        const fincodes = rosterData?.map(r => r.fincode) || []

        const { data: allAthletes, error: athletesError } = await supabase
          .from('athletes')
          .select('fincode, firstname, lastname, gender')
          .in('fincode', fincodes)
          .order('lastname')

        if (athletesError) throw athletesError
        athleteData = allAthletes || []
      } else {
        // Use the database function for group-specific athletes
        const { data, error } = await supabase
          .rpc('get_athletes_details', {
            p_season_id: selectedSeason.season_id,
            p_group_id: session.sess_group_id
          })

        if (error) throw error
        athleteData = data || []
      }

      // Fetch existing attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('fincode, status_code, att_id')
        .eq('sess_id', session.sess_id)

      if (attendanceError) throw attendanceError

      // Merge attendance data with athletes
      const athletesWithAttendance = athleteData.map(athlete => {
        const attendance = attendanceData?.find(a => a.fincode === athlete.fincode)
        return {
          ...athlete,
          attendance_status: attendance?.status_code,
          att_id: attendance?.att_id
        }
      })

      setAthletes(athletesWithAttendance)
    } catch (error) {
      console.error('Error fetching eligible athletes:', error)
      setAthletes([])
    } finally {
      setLoading(false)
    }
  }

  async function updateAttendance(athlete: Athlete, statusCode: number) {
    if (!selectedSession) return

    try {
      setSavingAttendance(true)

      if (athlete.att_id) {
        // Update existing attendance
        const { error } = await supabase
          .from('attendance')
          .update({ status_code: statusCode })
          .eq('att_id', athlete.att_id)

        if (error) throw error
      } else {
        // Insert new attendance
        const { error } = await supabase
          .from('attendance')
          .insert({
            sess_id: selectedSession.sess_id,
            fincode: athlete.fincode,
            status_code: statusCode
          })

        if (error) throw error
      }

      // Update local state
      setAthletes(prev => prev.map(a => 
        a.fincode === athlete.fincode 
          ? { ...a, attendance_status: statusCode }
          : a
      ))
    } catch (error) {
      console.error('Error updating attendance:', error)
      alert('Failed to update attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  function formatTime(time: string): string {
    return time.substring(0, 5)
  }

  function getStatusIcon(status?: number) {
    if (status === 0) return <Check className="h-5 w-5 text-green-600" />
    if (status === 1) return <ShieldCheck className="h-5 w-5 text-blue-600" />
    if (status === 2) return <Clock className="h-5 w-5 text-yellow-600" />
    if (status === 3) return <X className="h-5 w-5 text-red-600" />
    return null
  }

  const presentCount = athletes.filter(a => a.attendance_status === 0).length
  const justifiedCount = athletes.filter(a => a.attendance_status === 1).length
  const lateCount = athletes.filter(a => a.attendance_status === 2).length
  const absentCount = athletes.filter(a => a.attendance_status === 3).length

  // Calendar functions
  function getDaysInMonth(month: number, year: number) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(month: number, year: number) {
    const day = new Date(year, month, 1).getDay()
    // Convert Sunday (0) to 6, and shift Monday-Saturday to 0-5
    return day === 0 ? 6 : day - 1
  }

  function getSessionsForDate(date: Date) {
    return sessions.filter(session => {
      const sessionDate = new Date(session.date)
      return sessionDate.getDate() === date.getDate() &&
             sessionDate.getMonth() === date.getMonth() &&
             sessionDate.getFullYear() === date.getFullYear()
    })
  }

  function navigateMonth(direction: 'prev' | 'next') {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear(currentYear - 1)
      } else {
        setCurrentMonth(currentMonth - 1)
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear(currentYear + 1)
      } else {
        setCurrentMonth(currentMonth + 1)
      }
    }
  }

  function generateCalendarDays() {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear)
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear)
    const days: (Date | null)[] = []

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day))
    }

    return days
  }

  const calendarDays = generateCalendarDays()
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Session Attendance</h1>
        </div>
        <p className="text-muted-foreground">
          Track athlete attendance for training sessions
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Training Sessions</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[150px] text-center">{monthName}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>Click on a session icon to manage attendance</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !selectedSession ? (
              <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
            ) : (
              <div>
                {/* Calendar Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="aspect-square" />
                    }
                    const daySessions = getSessionsForDate(date)
                    const isToday = date.toDateString() === new Date().toDateString()
                    return (
                      <div
                        key={index}
                        className={`aspect-square border rounded-lg p-1 flex flex-col items-center justify-start ${
                          isToday ? 'bg-primary/5 border-primary' : 'border-border'
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${
                          isToday ? 'text-primary' : 'text-foreground'
                        }`}>
                          {date.getDate()}
                        </div>
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {daySessions.map(session => (
                            <button
                              key={session.sess_id}
                              onClick={() => setSelectedSession(session)}
                              className={`p-1 rounded hover:bg-accent transition-colors ${
                                selectedSession?.sess_id === session.sess_id
                                  ? 'bg-primary text-primary-foreground'
                                  : ''
                              }`}
                              title={`${formatTime(session.time)} - ${session.type}${session.group_name ? ` (${session.group_name})` : ''}`}
                            >
                              {session.type === 'Swim' ? (
                                <Waves className="h-3 w-3 text-blue-500" />
                              ) : (
                                <Dumbbell className="h-3 w-3 text-orange-500" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Management */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSession ? `Attendance - ${new Date(selectedSession.date).toLocaleDateString()}` : 'Select a Session'}
            </CardTitle>
            {selectedSession && (
              <CardDescription>
                {selectedSession.group_name ? `Group: ${selectedSession.group_name}` : 'All athletes'}
                {athletes.length > 0 && (
                  <span className="ml-2">({athletes.length} athletes)</span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <div className="text-center py-12 text-muted-foreground">
                Select a session to manage attendance
              </div>
            ) : loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading athletes...</div>
            ) : athletes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No eligible athletes found for this session
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{presentCount}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{justifiedCount}</div>
                    <div className="text-xs text-muted-foreground">Justified</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{lateCount}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{absentCount}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                </div>

                {/* Athletes List */}
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                  {athletes.map(athlete => (
                    <div
                      key={athlete.fincode}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(athlete.attendance_status)}
                        <div>
                          <div className="font-medium">
                            {athlete.firstname} {athlete.lastname}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            FIN: {athlete.fincode} • {athlete.gender}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={athlete.attendance_status === 0 ? 'default' : 'outline'}
                          onClick={() => updateAttendance(athlete, 0)}
                          disabled={savingAttendance}
                          className="h-8 w-8 p-0"
                          title="Present"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={athlete.attendance_status === 1 ? 'default' : 'outline'}
                          onClick={() => updateAttendance(athlete, 1)}
                          disabled={savingAttendance}
                          className="h-8 w-8 p-0"
                          title="Justified"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={athlete.attendance_status === 2 ? 'default' : 'outline'}
                          onClick={() => updateAttendance(athlete, 2)}
                          disabled={savingAttendance}
                          className="h-8 w-8 p-0"
                          title="Late"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={athlete.attendance_status === 3 ? 'default' : 'outline'}
                          onClick={() => updateAttendance(athlete, 3)}
                          disabled={savingAttendance}
                          className="h-8 w-8 p-0"
                          title="Absent"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
