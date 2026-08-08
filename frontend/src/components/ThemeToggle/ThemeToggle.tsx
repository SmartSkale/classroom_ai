import { useTheme } from '../../hooks/useTheme'
import './ThemeToggle.css'

interface ThemeToggleProps {
  compact?: boolean
  variant?: 'default' | 'nav'
}

export function ThemeToggle({ compact = false, variant = 'default' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' theme-toggle-compact' : ''}${variant === 'nav' ? ' theme-toggle-nav' : ''}`}
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isLight ? '🌙' : '☀️'}
      </span>
      {!compact && (
        <span className="theme-toggle-label">{isLight ? 'Dark mode' : 'Light mode'}</span>
      )}
    </button>
  )
}

export default ThemeToggle
