import { useEffect, useState } from 'react'
import { formatRelativeTime } from '../utils/formatDate'

function tickIntervalMs(value: string | number | Date): number {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 60_000
  const ageSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (ageSeconds < 3600) return 30_000
  return 60_000
}

/** Returns a live-updating relative time label (e.g. "5m", "3h", "2d"). */
export function useRelativeTime(value: string | number | Date): string {
  const [label, setLabel] = useState(() => formatRelativeTime(value))

  useEffect(() => {
    const refresh = () => setLabel(formatRelativeTime(value))
    refresh()
    const id = window.setInterval(refresh, tickIntervalMs(value))
    return () => window.clearInterval(id)
  }, [value])

  return label
}

export default useRelativeTime
