import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, Clock, Award, BarChart3, Hash, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const tools = [
  {
    title: 'Pace Calculator',
    description: 'Calculate swim paces for different distances',
    icon: Calculator,
    action: 'Open Calculator',
    path: null,
  },
  {
    title: 'Time Converter',
    description: 'Convert between different time formats',
    icon: Clock,
    action: 'Open Converter',
    path: null,
  },
  {
    title: 'Meet Results',
    description: 'Analyze and compare meet results',
    icon: Award,
    action: 'View Results',
    path: null,
  },
  {
    title: 'Performance Analytics',
    description: 'Track athlete performance over time',
    icon: BarChart3,
    action: 'View Analytics',
    path: null,
  },
  {
    title: 'Permillili',
    description: 'Show the best points for every swimmer',
    icon: Hash,
    action: 'View Permillili',
    path: '/permillili',
  },
  {
    title: 'Attendance Summary',
    description: 'View attendance metrics summary',
    icon: TrendingUp,
    action: 'View Summary',
    path: '/attsumm',
  },
  {
    title: 'Attendance Trend',
    description: 'View detailed attendance trends over time',
    icon: TrendingUp,
    action: 'View Trend',
    path: '/atttrend',
  },
  {
    title: 'Personal Bests',
    description: 'View best times for each swimmer in each race',
    icon: Award,
    action: 'View PBs',
    path: '/pb',
  },
]

export function Tools() {
  const navigate = useNavigate()

  const handleToolClick = (path: string | null) => {
    if (path) {
      navigate(path)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Tools</h1>
        <p className="text-muted-foreground mt-2">
          Access training and management tools
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {tools.map((tool) => (
          <Card key={tool.title} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <tool.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{tool.title}</CardTitle>
              </div>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => handleToolClick(tool.path)}
                disabled={!tool.path}
              >
                {tool.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            More tools and features are in development
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Workout generator</li>
            <li>Season planning tool</li>
            <li>Team management dashboard</li>
            <li>Progress tracking charts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
