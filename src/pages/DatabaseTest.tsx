import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export function DatabaseTest() {
  const [testResults, setTestResults] = useState<any>({})

  useEffect(() => {
    testConnections()
  }, [])

  async function testConnections() {
    const results: any = {}

    // Test athletes table
    try {
      const { data, error, count } = await supabase
        .from('athletes')
        .select('*', { count: 'exact' })
        .limit(5)
      
      results.athletes = {
        success: !error,
        error: error?.message,
        count: count,
        data: data,
        details: error ? JSON.stringify(error, null, 2) : null
      }
    } catch (e: any) {
      results.athletes = { success: false, error: e.message }
    }

    // Test meets table
    try {
      const { data, error, count } = await supabase
        .from('meets')
        .select('*', { count: 'exact' })
        .limit(5)
      
      results.meets = {
        success: !error,
        error: error?.message,
        count: count,
        data: data,
        details: error ? JSON.stringify(error, null, 2) : null
      }
    } catch (e: any) {
      results.meets = { success: false, error: e.message }
    }

    // Test sessions table
    try {
      const { data, error, count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact' })
        .limit(5)
      
      results.sessions = {
        success: !error,
        error: error?.message,
        count: count,
        data: data,
        details: error ? JSON.stringify(error, null, 2) : null
      }
    } catch (e: any) {
      results.sessions = { success: false, error: e.message }
    }

    // Test connection
    try {
      const { error } = await supabase.from('_races').select('*').limit(1)
      results.connection = {
        success: !error,
        error: error?.message,
        details: error ? JSON.stringify(error, null, 2) : null
      }
    } catch (e: any) {
      results.connection = { success: false, error: e.message }
    }

    setTestResults(results)
    console.log('Database Test Results:', results)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Database Connection Test</h1>
      
      {Object.entries(testResults).map(([table, result]: [string, any]) => (
        <Card key={table}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {table}
              {result.success ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-red-500">✗</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {result.success ? (
                <>
                  <p className="text-green-600">Connection successful!</p>
                  <p>Count: {result.count ?? 'N/A'}</p>
                  {result.data && result.data.length > 0 && (
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(result.data[0], null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <>
                  <p className="text-red-600">Error: {result.error}</p>
                  {result.details && (
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {result.details}
                    </pre>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
