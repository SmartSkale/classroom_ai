const ISO_NO_TZ_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

/** Parse API/SQLite datetimes; naive values are treated as UTC. */
export function parseApiDate(value: string | number | Date): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  const trimmed = value.trim()
  if (!trimmed) return new Date(NaN)
  if (ISO_NO_TZ_RE.test(trimmed) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed.replace(' ', 'T')}Z`)
  }
  return new Date(trimmed)
}

export function formatDate(
  value: string | number | Date,
  locale = 'en-US',
): string {
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(
  value: string | number | Date,
  locale = 'en-US',
): string {
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Compact "time ago" label, e.g. "3h", "12h", "1d", "2w". */
export function formatRelativeTime(value: string | number | Date): string {
  const date = parseApiDate(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(days / 365)}y`
}
