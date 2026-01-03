import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Dashboard } from './pages/Dashboard'
import { Meets } from './pages/Meets'
import { Athletes } from './pages/Athletes'
import { Trainings } from './pages/Trainings'
import { Tools } from './pages/Tools'
import { Permillili } from './pages/Permillili'
import { DatabaseTest } from './pages/DatabaseTest'
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
            <Route path="/tools" element={<Tools />} />
            <Route path="/permillili" element={<Permillili />} />
            <Route path="/test" element={<DatabaseTest />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </SeasonProvider>
  )
}

export default App
