import { useEffect, type ReactNode } from 'react'
import { useStore } from '../store'
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

  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const value: AuthContextValue = {
    user,
    token,
    status,
    error,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
