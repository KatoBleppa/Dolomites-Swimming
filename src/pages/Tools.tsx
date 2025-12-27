import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, Clock, Award, BarChart3 } from 'lucide-react'

const tools = [
  {
    title: 'Pace Calculator',
    description: 'Calculate swim paces for different distances',
    icon: Calculator,
    action: 'Open Calculator',
  },
  {
    title: 'Time Converter',
    description: 'Convert between different time formats',
    icon: Clock,
    action: 'Open Converter',
  },
  {
    title: 'Meet Results',
    description: 'Analyze and compare meet results',
    icon: Award,
    action: 'View Results',
  },
  {
    title: 'Performance Analytics',
    description: 'Track athlete performance over time',
    icon: BarChart3,
    action: 'View Analytics',
  },
]

export function Tools() {
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
              <Button variant="outline" className="w-full">
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
