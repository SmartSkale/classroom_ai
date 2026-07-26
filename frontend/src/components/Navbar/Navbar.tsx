import { Link, useLocation } from 'react-router-dom'
import { Button } from '../Button'
import { Logo } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../utils/constants'
import './Navbar.css'

const HOME_NAV_LINKS = [
  { label: 'Teacher Journey', href: '#how-it-works' },
  { label: 'Parent Journey', href: '#parent-journey' },
  { label: 'Student Journey', href: '#student-journey' },
  { label: 'Features', href: '#features' },
] as const

export function Navbar() {
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const isHome = location.pathname === ROUTES.home

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Logo className="navbar-logo" size="md" />

        {isHome && (
          <nav className="navbar-links" aria-label="Page sections">
            {HOME_NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={location.hash === link.href ? 'active' : undefined}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="navbar-actions">
          <ThemeToggle compact />
          {isAuthenticated ? (
            <>
              <Link className="navbar-greeting" to={ROUTES.dashboard}>
                {user?.full_name || user?.email}
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <Link to={ROUTES.login} state={{ mode: 'login' }}>
              <Button variant="primary" size="sm">
                Login / Register
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
