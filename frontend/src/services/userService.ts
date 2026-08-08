import api from './api'
import type { User } from './authService'

/** GET /auth/users — list all users (admin only). */
async function listUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/auth/users')
  return data
}

export const userService = { listUsers }
export default userService
