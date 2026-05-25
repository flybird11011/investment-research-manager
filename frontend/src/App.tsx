import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import NewsFeed from './pages/NewsFeed'
import Watchlist from './pages/Watchlist'
import Reports from './pages/Reports'
import FlashMode from './pages/FlashMode'
import AIAssistant from './pages/AIAssistant'
import DailyBriefing from './pages/DailyBriefing'
import Settings from './pages/Settings'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<NewsFeed />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/flash" element={<FlashMode />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/briefing" element={<DailyBriefing />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App
