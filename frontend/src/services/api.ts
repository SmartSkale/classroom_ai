import axios from 'axios'
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../utils/constants'
import { isTokenExpired } from '../utils/jwt'
import { recordActivity } from '../utils/activityTracker'

export const AUTH_SESSION_EXPIRED_EVENT = 'classroomai:session-expired'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

/** Clear stored credentials and notify listeners (auth store, timeout UI, etc.). */
export function forceSessionExpiry() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  const isRefresh = (config.url ?? '').includes('/auth/refresh')
  if (token) {
    if (isTokenExpired(token) && !isRefresh) {
      forceSessionExpiry()
      return Promise.reject(new Error('Session expired'))
    }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    recordActivity()
    return response
  },
  (error) => {
    const isRefresh = (error.config?.url ?? '').includes('/auth/refresh')
    if (error.response?.status === 401 && !isRefresh) {
      forceSessionExpiry()
    }
    return Promise.reject(error)
  },
)

export default api
