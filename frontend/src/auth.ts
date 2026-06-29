const API = '/api/v1'
const TOKEN_KEY = 'classroom_ai_token'

export type UserRole = 'teacher' | 'student' | 'course_creator' | 'admin'

export type AuthUser = {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  teacher: 'Teacher',
  student: 'Student',
  course_creator: 'Course Creator',
  admin: 'Admin',
}

export const REGISTERABLE_ROLES: UserRole[] = ['student', 'teacher', 'course_creator']

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) return JSON.stringify(j.detail)
    return JSON.stringify(j)
  } catch {
    return res.statusText
  }
}

export async function login(email: string, password: string): Promise<string> {
  const body = new URLSearchParams()
  body.set('username', email.trim().toLowerCase())
  body.set('password', password)

  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export async function register(body: {
  email: string
  password: string
  full_name: string
  role: UserRole
}): Promise<AuthUser> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      full_name: body.full_name.trim(),
      role: body.role,
    }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
