/** Return true when a JWT bearer token is missing or past its `exp` claim. */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true
  try {
    const segment = token.split('.')[1]
    if (!segment) return true
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number
    }
    if (typeof payload.exp !== 'number') return true
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}
