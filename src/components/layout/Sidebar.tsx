import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  Trophy, 
  Users, 
  Dumbbell, 
  Wrench,
  LayoutDashboard
} from 'lucide-react'
import { useSeason } from '@/contexts/SeasonContext'
import dolomitesLogo from '@/assets/dolomites-logo-2.gif'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Meets', href: '/meets', icon: Trophy },
  { name: 'Athletes', href: '/athletes', icon: Users },
  { name: 'Trainings', href: '/trainings', icon: Dumbbell },
  { name: 'Tools', href: '/tools', icon: Wrench },
]

export function Sidebar() {
  const location = useLocation()
  const { selectedSeason, seasons, setSelectedSeason, loading: seasonLoading } = useSeason()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex flex-col items-center border-b px-6 py-4 gap-3">
        <img 
          src={dolomitesLogo} 
          alt="Dolomites Swimming Logo" 
          className="w-20 h-20 object-contain"
        />
        <h1 className="text-xl font-bold text-primary">Dolomites Swimming</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      {/* Season Selector */}
      <div className="border-t p-4">
        <label htmlFor="season-select" className="block text-xs font-medium mb-2 text-muted-foreground">
          Active Season
        </label>
        <select
          id="season-select"
          value={selectedSeason?.season_id || ''}
          onChange={(e) => {
            const season = seasons.find(s => s.season_id === Number(e.target.value))
            if (season) setSelectedSeason(season)
          }}
          disabled={seasonLoading}
          className="block w-full px-3 py-2 text-sm border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        >
          {seasons.map((season) => (
            <option key={season.season_id} value={season.season_id}>
              {season.season_name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
