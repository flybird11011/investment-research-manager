import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import NewsFeed from './pages/NewsFeed'
import Watchlist from './pages/Watchlist'
import Reports from './pages/Reports'
import FlashMode from './pages/FlashMode'
import AIAssistant from './pages/AIAssistant'
import DailyBriefing from './pages/DailyBriefing'
import Settings from './pages/Settings'
import Login from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout><NewsFeed /></Layout></ProtectedRoute>} />
      <Route path="/watchlist" element={<ProtectedRoute><Layout><Watchlist /></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
      <Route path="/flash" element={<ProtectedRoute><Layout><FlashMode /></Layout></ProtectedRoute>} />
      <Route path="/ai" element={<ProtectedRoute><Layout><AIAssistant /></Layout></ProtectedRoute>} />
      <Route path="/briefing" element={<ProtectedRoute><Layout><DailyBriefing /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
