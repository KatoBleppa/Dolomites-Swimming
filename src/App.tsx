import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Dashboard } from './pages/Dashboard'
import { Meets } from './pages/Meets'
import { Athletes } from './pages/Athletes'
import { Trainings } from './pages/Trainings'
import { Attendance } from './pages/Attendance'
import { Tools } from './pages/Tools'
import { Permillili } from './pages/Tools/Permillili'
import { AttSumm } from './pages/Tools/AttSumm'
import { AttTrend } from './pages/Tools/AttTrend'
import { DatabaseTest } from './pages/DatabaseTest'
import { PB } from './pages/Tools/PB'
import { ImportLenex } from './pages/Tools/ImportLenex'
import { ImportJson } from './pages/Tools/ImportJson'
import { Progress } from './pages/Tools/Progress'
import { EntrySheet } from './pages/EntrySheet'
import { SeasonProvider } from './contexts/SeasonContext'

function App() {
  return (
    <SeasonProvider>
      <BrowserRouter>
        <DashboardLayout>
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
            <Route path="/import-json" element={<ImportJson />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/entry-sheet" element={<EntrySheet />} />
            <Route path="/test" element={<DatabaseTest />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </SeasonProvider>
  )
}

export default App
