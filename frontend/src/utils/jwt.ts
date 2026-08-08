interface JwtPayload {
  exp?: number
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    return JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload
  } catch {
    return null
  }
}

/** Return true when a JWT bearer token is missing or past its `exp` claim. */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() >= payload.exp * 1000
}

/** Milliseconds until the token expires (0 if already expired or invalid). */
export function getTokenExpiresInMs(token: string | null | undefined): number {
  if (!token) return 0
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return 0
  return Math.max(0, payload.exp * 1000 - Date.now())
}

/** Format milliseconds as `M:SS` for session timeout countdowns. */
export function formatSessionCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
