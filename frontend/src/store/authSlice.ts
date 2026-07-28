import type { StateCreator } from 'zustand'
import authService, {
  type User,
  type RegisterPayload,
  type UserUpdatePayload,
  type ChangePasswordPayload,
} from '../services/authService'
import { TOKEN_STORAGE_KEY } from '../utils/constants'
import { isTokenExpired } from '../utils/jwt'
import { recordActivity } from '../utils/activityTracker'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface AuthSlice {
  user: User | null
  token: string | null
  status: AuthStatus
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshSession: () => Promise<void>
  loadSession: () => Promise<void>
  updateProfile: (payload: UserUpdatePayload) => Promise<string | null>
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
  setUser: (user: User) => void
  clearError: () => void
}

function persistToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
if (storedToken && isTokenExpired(storedToken)) {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}
const initialToken =
  storedToken && !isTokenExpired(storedToken) ? storedToken : null

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  token: initialToken,
  status: initialToken ? 'loading' : 'idle',
  error: null,

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const { access_token } = await authService.login(email, password)
      persistToken(access_token)
      set({ token: access_token })
      recordActivity()
      const user = await authService.getCurrentUser()
      set({ user, status: 'authenticated' })
    } catch {
      persistToken(null)
      set({ token: null, user: null, status: 'error', error: 'Invalid email or password.' })
    }
  },

  register: async (payload) => {
    set({ status: 'loading', error: null })
    try {
      await authService.register(payload)
      const { access_token } = await authService.login(payload.email, payload.password)
      persistToken(access_token)
      set({ token: access_token })
      recordActivity()
      const user = await authService.getCurrentUser()
      set({ user, status: 'authenticated' })
    } catch {
      set({ status: 'error', error: 'Registration failed. The email may already be in use.' })
    }
  },

  logout: () => {
    persistToken(null)
    set({ user: null, token: null, status: 'idle', error: null })
  },

  refreshSession: async () => {
    const { access_token } = await authService.refreshSession()
    persistToken(access_token)
    set({ token: access_token })
    recordActivity()
  },

  loadSession: async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token || isTokenExpired(token)) {
      persistToken(null)
      set({ status: 'idle', token: null, user: null })
      return
    }
    set({ status: 'loading', token })
    try {
      const user = await authService.getCurrentUser()
      set({ user, status: 'authenticated' })
      recordActivity()
    } catch {
      persistToken(null)
      set({ user: null, token: null, status: 'idle' })
    }
  },

  updateProfile: async (payload) => {
    const { user, access_token } = await authService.updateProfile(payload)
    if (access_token) {
      persistToken(access_token)
      set({ token: access_token })
    }
    set({ user })
    return access_token ?? null
  },

  changePassword: async (payload) => {
    await authService.changePassword(payload)
  },

  setUser: (user) => set({ user }),

  clearError: () => set({ error: null, status: 'idle' }),
})
