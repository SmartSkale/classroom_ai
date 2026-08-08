import { formatDateTime } from '../../utils/formatDate'
import { useRelativeTime } from '../../hooks/useRelativeTime'

interface RelativeTimeProps {
  value: string | number | Date
  prefix?: string
  className?: string
}

export function RelativeTime({ value, prefix = '', className }: RelativeTimeProps) {
  const label = useRelativeTime(value)
  const title = formatDateTime(value)

  return (
    <span className={className} title={title || undefined}>
      {prefix}
      {label}
    </span>
  )
}

export default RelativeTime
