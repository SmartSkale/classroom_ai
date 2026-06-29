import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCurrentUser,
  getStoredToken,
  login as loginApi,
  register as registerApi,
  setStoredToken,
  type AuthUser,
  type UserRole,
} from './auth'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (body: {
    email: string
    password: string
    full_name: string
    role: UserRole
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const me = await fetchCurrentUser(token)
        if (!cancelled) setUser(me)
      } catch {
        setStoredToken(null)
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const accessToken = await loginApi(email, password)
    setStoredToken(accessToken)
    setToken(accessToken)
    const me = await fetchCurrentUser(accessToken)
    setUser(me)
  }, [])

  const register = useCallback(
    async (body: { email: string; password: string; full_name: string; role: UserRole }) => {
      await registerApi(body)
      await login(body.email, body.password)
    },
    [login],
  )

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
