import { Link } from 'react-router-dom'
import { APP_NAME, ROUTES } from '../../utils/constants'
import { useTheme } from '../../hooks/useTheme'
import logoIcon from '../../assets/logo-icon.svg'
import logoFull from '../../assets/logo.svg'
import './Logo.css'

interface LogoProps {
  /** Full horizontal lockup (icon + wordmark in one SVG) */
  variant?: 'icon' | 'full'
  /** Link destination; omit to render a non-link logo */
  to?: string
  className?: string
  /** Icon only — hide the wordmark */
  compact?: boolean
}

export function Logo({ variant = 'icon', to = ROUTES.home, className = '', compact = false }: LogoProps) {
  const { theme } = useTheme()
  const showWordmark = variant === 'full' || !compact
  const useFullSvg = showWordmark && theme === 'light'

  const content = compact ? (
    <img className="logo logo-icon" src={logoIcon} alt={APP_NAME} width={32} height={32} />
  ) : useFullSvg ? (
    <img
      className={`logo logo-full${variant === 'full' ? ' logo-full-lg' : ''}`}
      src={logoFull}
      alt={APP_NAME}
      height={variant === 'full' ? 40 : 32}
    />
  ) : (
    <>
      <img
        className={`logo logo-icon${variant === 'full' ? ' logo-icon-lg' : ''}`}
        src={logoIcon}
        alt=""
        width={variant === 'full' ? 40 : 32}
        height={variant === 'full' ? 40 : 32}
        aria-hidden="true"
      />
      <span className={`logo-text${variant === 'full' ? ' logo-text-lg' : ''}`}>
        Classroom<span className="logo-text-accent">AI</span>
      </span>
    </>
  )

  const classes = ['logo-wrap', className].filter(Boolean).join(' ')

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
