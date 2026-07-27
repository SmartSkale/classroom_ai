import axios from 'axios'
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '../utils/constants'
import { isTokenExpired } from '../utils/jwt'

export const AUTH_SESSION_EXPIRED_EVENT = 'classroomai:session-expired'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    if (isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
      return Promise.reject(new Error('Session expired'))
    }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export default api
