import { Link, NavLink } from 'react-router-dom'
import { Button } from '../Button'
import { useAuth } from '../../hooks/useAuth'
import { APP_NAME, ROUTES } from '../../utils/constants'
import './Navbar.css'

const NAV_LINKS = [
  { label: 'Home', to: ROUTES.home },
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/#pricing' },
]

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link className="navbar-logo" to={ROUTES.home}>
          <span className="navbar-logo-mark">CA</span>
          <span className="navbar-logo-text">{APP_NAME}</span>
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-actions">
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
            <>
              <Link to={ROUTES.login} state={{ mode: 'login' }}>
                <Button variant="primary" size="sm">
                  Login
                </Button>
              </Link>
              <Link to={ROUTES.login} state={{ mode: 'register' }}>
                <Button variant="primary" size="sm">
                  Register
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Navbar
