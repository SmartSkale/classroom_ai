import { Link } from 'react-router-dom'
import { Button } from '../Button'
import { Logo } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../utils/constants'
import './Navbar.css'

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Logo className="navbar-logo" size="md" />

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
