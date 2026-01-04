import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users, Calendar, Activity, Waves, Dumbbell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSeason } from '@/contexts/SeasonContext'

export function Dashboard() {
  const navigate = useNavigate()
  const { selectedSeason } = useSeason()
  const [stats, setStats] = useState({
    athletes: 0,
    meets: 0,
    swimSessions: 0,
    gymSessions: 0,
    results: 0,
    loading: true
  })

  useEffect(() => {
    if (selectedSeason) {
      fetchStats()
    }
  }, [selectedSeason])

  async function fetchStats() {
    if (!selectedSeason) return

    try {
      // Get roster for selected season
      const { data: rosterData } = await supabase
        .from('roster')
        .select('fincode')
        .eq('season_id', selectedSeason.season_id)

      const fincodes = rosterData?.map(r => r.fincode) || []

      // Get athletes count (only those in season roster)
      const athletesCount = fincodes.length

      // Get meets count (filtered by season date range)
      const { count: meetsCount } = await supabase
        .from('meets')
        .select('meet_id', { count: 'exact', head: true })
        .gte('min_date', selectedSeason.season_start)
        .lte('max_date', selectedSeason.season_end)

      // Get swim sessions count (filtered by season date range)
      const { count: swimSessionsCount } = await supabase
        .from('sessions')
        .select('sess_id', { count: 'exact', head: true })
        .gte('date', selectedSeason.season_start)
        .lte('date', selectedSeason.season_end)
        .eq('type', 'Swim')

      // Get gym sessions count (filtered by season date range)
      const { count: gymSessionsCount } = await supabase
        .from('sessions')
        .select('sess_id', { count: 'exact', head: true })
        .gte('date', selectedSeason.season_start)
        .lte('date', selectedSeason.season_end)
        .eq('type', 'Gym')

      // Get meets in season first
      const { data: seasonMeets } = await supabase
        .from('meets')
        .select('meet_id')
        .gte('min_date', selectedSeason.season_start)
        .lte('max_date', selectedSeason.season_end)

      const meetIds = seasonMeets?.map(m => m.meet_id) || []

      // Get results count (only for athletes in roster and meets in season)
      const { count: resultsCount } = await supabase
        .from('results')
        .select('res_id', { count: 'exact', head: true })
        .in('fincode', fincodes.length > 0 ? fincodes : [-1])
        .in('meet_id', meetIds.length > 0 ? meetIds : [-1])

      setStats({
        athletes: athletesCount,
        meets: meetsCount || 0,
        swimSessions: swimSessionsCount || 0,
        gymSessions: gymSessionsCount || 0,
        results: resultsCount || 0,
        loading: false
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  const dashboardCards = [
    {
      title: 'Athletes',
      description: 'Registered swimmers',
      icon: Users,
      href: '/athletes',
      color: 'text-blue-500',
      count: stats.athletes,
    },
    {
      title: 'Meets',
      description: 'Competitions & events',
      icon: Trophy,
      href: '/meets',
      color: 'text-green-500',
      count: stats.meets,
    },
    {
      title: 'Swim Sessions',
      description: 'Swimming trainings',
      icon: Waves,
      href: '/trainings',
      color: 'text-blue-500',
      count: stats.swimSessions,
    },
    {
      title: 'Gym Sessions',
      description: 'Gym trainings',
      icon: Dumbbell,
      href: '/trainings',
      color: 'text-amber-500',
      count: stats.gymSessions,
    },
    {
      title: 'Results',
      description: 'Competition results',
      icon: Activity,
      href: '/meets',
      color: 'text-purple-500',
      count: stats.results,
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome to Dolomites Swimming management system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5 mb-8">
        {dashboardCards.map((card) => (
          <div 
            key={card.href}
            className="cursor-pointer"
            onClick={() => navigate(card.href)}
          >
            <Card className="transition-all hover:shadow-lg hover:scale-105 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.loading ? '...' : card.count}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your swimming club</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/athletes" className="block p-3 rounded hover:bg-accent transition-colors">
              <div className="font-medium">Add New Athlete</div>
              <div className="text-sm text-muted-foreground">Register a new swimmer</div>
            </Link>
            <Link to="/meets" className="block p-3 rounded hover:bg-accent transition-colors">
              <div className="font-medium">Schedule Meet</div>
              <div className="text-sm text-muted-foreground">Create a new competition</div>
            </Link>
            <Link to="/trainings" className="block p-3 rounded hover:bg-accent transition-colors">
              <div className="font-medium">Plan Training</div>
              <div className="text-sm text-muted-foreground">Schedule a training session</div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Status</CardTitle>
            <CardDescription>Connection to Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <div className="text-muted-foreground">Connecting to database...</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-sm">Connected to Supabase</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last sync: {new Date().toLocaleTimeString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
