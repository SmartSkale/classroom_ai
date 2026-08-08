import { Link } from 'react-router-dom'
import { APP_NAME, ROUTES } from '../../utils/constants'
import { useTheme } from '../../hooks/useTheme'
import logoIcon from '../../assets/logo-icon.svg'
import logoFull from '../../assets/logo.svg'
import './Logo.css'

type LogoSize = 'sm' | 'md' | 'lg'

interface LogoProps {
  /** Full horizontal lockup (icon + wordmark in one SVG) */
  variant?: 'icon' | 'full'
  /** Logo scale — use md on the home navbar for a consistent medium lockup */
  size?: LogoSize
  /** Link destination; omit to render a non-link logo */
  to?: string
  className?: string
  /** Icon only — hide the wordmark */
  compact?: boolean
}

const SIZE_ICON: Record<LogoSize, number> = {
  sm: 28,
  md: 32,
  lg: 40,
}

export function Logo({
  variant = 'icon',
  size,
  to = ROUTES.home,
  className = '',
  compact = false,
}: LogoProps) {
  const { theme } = useTheme()
  const showWordmark = variant === 'full' || !compact
  const isLarge = variant === 'full' || size === 'lg'
  const iconSize = size ? SIZE_ICON[size] : isLarge ? 40 : 32
  const useFullSvg = showWordmark && theme === 'light' && size !== 'md' && size !== 'sm'

  const content = compact ? (
    <img className="logo logo-icon" src={logoIcon} alt={APP_NAME} width={iconSize} height={iconSize} />
  ) : useFullSvg ? (
    <img
      className={`logo logo-full${isLarge ? ' logo-full-lg' : ''}`}
      src={logoFull}
      alt={APP_NAME}
      height={iconSize}
    />
  ) : (
    <>
      <img
        className={`logo logo-icon${isLarge ? ' logo-icon-lg' : ''}`}
        src={logoIcon}
        alt=""
        width={iconSize}
        height={iconSize}
        aria-hidden="true"
      />
      <span
        className={`logo-text${isLarge ? ' logo-text-lg' : size === 'sm' ? ' logo-text-sm' : ''}`}
      >
        Classroom<span className="logo-text-accent">AI</span>
      </span>
    </>
  )

  const classes = ['logo-wrap', size ? `logo-wrap-${size}` : '', className].filter(Boolean).join(' ')

  if (to) {
    return (
      <Link className={classes} to={to} title={APP_NAME}>
        {content}
      </Link>
    )
  }

  return <div className={classes}>{content}</div>
}

export default Logo
