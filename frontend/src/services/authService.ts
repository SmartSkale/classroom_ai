import api from './api'
import type { UserRole } from '../utils/constants'

export interface User {
  id: number
  email: string
  full_name?: string
  role: UserRole
  is_active?: boolean
  created_at?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface UserUpdatePayload {
  full_name?: string
  email?: string
}

export interface UserUpdateResponse {
  user: User
  access_token?: string | null
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
  role?: UserRole
}

/** POST /auth/login — expects form-encoded username/password. */
async function login(email: string, password: string): Promise<LoginResponse> {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const { data } = await api.post<LoginResponse>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

/** POST /auth/register — create a (non-admin) account. */
async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await api.post<User>('/auth/register', payload)
  return data
}

/** GET /auth/me — current user profile (requires bearer token). */
async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

/** PATCH /auth/me — update profile fields. */
async function updateProfile(payload: UserUpdatePayload): Promise<UserUpdateResponse> {
  const { data } = await api.patch<UserUpdateResponse>('/auth/me', payload)
  return data
}

/** POST /auth/change-password — change the current user's password. */
async function changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/change-password', payload)
  return data
}

export const authService = { login, register, getCurrentUser, updateProfile, changePassword }
export default authService
