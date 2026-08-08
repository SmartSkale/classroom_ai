import { createContext } from 'react'
import type { User, RegisterPayload, UserUpdatePayload, ChangePasswordPayload } from '../services/authService'
import type { AuthStatus } from '../store/authSlice'

export interface AuthContextValue {
  user: User | null
  token: string | null
  status: AuthStatus
  error: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshSession: () => Promise<void>
  updateProfile: (payload: UserUpdatePayload) => Promise<string | null>
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
  clearError: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
