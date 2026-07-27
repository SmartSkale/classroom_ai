import { useEffect, type ReactNode } from 'react'
import { useStore } from '../store'
import { AUTH_SESSION_EXPIRED_EVENT } from '../services/api'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user)
  const token = useStore((s) => s.token)
  const status = useStore((s) => s.status)
  const error = useStore((s) => s.error)
  const login = useStore((s) => s.login)
  const register = useStore((s) => s.register)
  const logout = useStore((s) => s.logout)
  const loadSession = useStore((s) => s.loadSession)
  const updateProfile = useStore((s) => s.updateProfile)
  const changePassword = useStore((s) => s.changePassword)
  const clearError = useStore((s) => s.clearError)

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  useEffect(() => {
    const onSessionExpired = () => {
      logout()
    }
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [logout])

  const value: AuthContextValue = {
    user,
    token,
    status,
    error,
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
