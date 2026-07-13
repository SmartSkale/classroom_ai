import type { StateCreator } from 'zustand'
import authService, {
  type User,
  type RegisterPayload,
  type UserUpdatePayload,
  type ChangePasswordPayload,
} from '../services/authService'
import { TOKEN_STORAGE_KEY } from '../utils/constants'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error'

export interface AuthSlice {
  user: User | null
  token: string | null
  status: AuthStatus
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  loadSession: () => Promise<void>
  updateProfile: (payload: UserUpdatePayload) => Promise<string | null>
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
  setUser: (user: User) => void
}

function persistToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY),
  status: 'idle',
  error: null,

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const { access_token } = await authService.login(email, password)
      persistToken(access_token)
      set({ token: access_token })
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

  loadSession: async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!token) return
    set({ status: 'loading', token })
    try {
      const user = await authService.getCurrentUser()
      set({ user, status: 'authenticated' })
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
})
