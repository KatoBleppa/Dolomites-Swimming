import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { SeasonProvider } from './contexts/SeasonContext'

// Lazy load all pages for better code splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Meets = lazy(() => import('./pages/Meets').then(m => ({ default: m.Meets })))
const Athletes = lazy(() => import('./pages/Athletes').then(m => ({ default: m.Athletes })))
const Trainings = lazy(() => import('./pages/Trainings').then(m => ({ default: m.Trainings })))
const Attendance = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })))
const Tools = lazy(() => import('./pages/Tools').then(m => ({ default: m.Tools })))
const Permillili = lazy(() => import('./pages/Tools/Permillili').then(m => ({ default: m.Permillili })))
const AttSumm = lazy(() => import('./pages/Tools/AttSumm').then(m => ({ default: m.AttSumm })))
const AttTrend = lazy(() => import('./pages/Tools/AttTrend').then(m => ({ default: m.AttTrend })))
const PB = lazy(() => import('./pages/Tools/PB').then(m => ({ default: m.PB })))
const ImportLenex = lazy(() => import('./pages/Tools/ImportLenex').then(m => ({ default: m.ImportLenex })))
const ImportEntries = lazy(() => import('./pages/Tools/ImportEntries').then(m => ({ default: m.ImportEntries })))
const ImportJson = lazy(() => import('./pages/Tools/ImportJson').then(m => ({ default: m.ImportJson })))
const Progress = lazy(() => import('./pages/Tools/Progress').then(m => ({ default: m.Progress })))
const EntrySheet = lazy(() => import('./pages/EntrySheet').then(m => ({ default: m.EntrySheet })))
const DatabaseTest = lazy(() => import('./pages/DatabaseTest').then(m => ({ default: m.DatabaseTest })))

function App() {
  return (
    <SeasonProvider>
      <BrowserRouter>
        <DashboardLayout>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-muted-foreground">Loading...</div></div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/meets" element={<Meets />} />
              <Route path="/athletes" element={<Athletes />} />
              <Route path="/trainings" element={<Trainings />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/permillili" element={<Permillili />} />
              <Route path="/attsumm" element={<AttSumm />} />
              <Route path="/atttrend" element={<AttTrend />} />
              <Route path="/pb" element={<PB />} />
              <Route path="/import-lenex" element={<ImportLenex />} />
              <Route path="/import-entries" element={<ImportEntries />} />
              <Route path="/import-json" element={<ImportJson />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/entry-sheet" element={<EntrySheet />} />
              <Route path="/test" element={<DatabaseTest />} />
            </Routes>
          </Suspense>
        </DashboardLayout>
      </BrowserRouter>
    </SeasonProvider>
  )
}

export default App
