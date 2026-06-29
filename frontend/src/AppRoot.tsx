import { useAuth } from './AuthContext'
import { AuthPage } from './AuthPage'
import App from './App'
import './AuthPage.css'

export function AppRoot() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!user) {
    return <AuthPage />
  }

  return <App />
}
