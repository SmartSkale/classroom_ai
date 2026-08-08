import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../Button'
import { Logo } from '../Logo'
import { ThemeToggle } from '../ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../utils/constants'
import {
  HOME_SECTIONS,
  homeSectionHref,
  observeHomeSections,
  scrollToHomeSection,
  type HomeSectionId,
} from '../../utils/homeSections'
import './Navbar.css'

const NAV_LOCK_MS = 900

export function Navbar() {
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const isHome = location.pathname === ROUTES.home

  const [activeSectionId, setActiveSectionId] = useState<HomeSectionId | null>(null)
  const navLockRef = useRef(false)
  const navLockTimerRef = useRef<number | null>(null)

  function lockNavUpdates() {
    navLockRef.current = true
    if (navLockTimerRef.current !== null) {
      window.clearTimeout(navLockTimerRef.current)
    }
    navLockTimerRef.current = window.setTimeout(() => {
      navLockRef.current = false
      navLockTimerRef.current = null
    }, NAV_LOCK_MS)
  }

  useEffect(() => {
    if (!isHome) {
      navLockRef.current = false
      if (navLockTimerRef.current !== null) {
        window.clearTimeout(navLockTimerRef.current)
        navLockTimerRef.current = null
      }
      setActiveSectionId(null)
      return
    }

    const hashId = location.hash ? location.hash.slice(1) : null
    const hashSection = HOME_SECTIONS.find((section) => section.id === hashId)
    if (hashSection) {
      setActiveSectionId(hashSection.id)
      lockNavUpdates()
    }

    let disconnectSpy: (() => void) | null = null

    const mountSpy = () => {
      disconnectSpy?.()
      disconnectSpy = observeHomeSections({
        onActiveSectionChange: setActiveSectionId,
        isLocked: () => navLockRef.current,
      })
    }

    const frameId = window.requestAnimationFrame(mountSpy)

    const onHashChange = () => {
      const id = window.location.hash.slice(1)
      const section = HOME_SECTIONS.find((s) => s.id === id)
      if (section) {
        setActiveSectionId(section.id)
        lockNavUpdates()
      }
    }
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.cancelAnimationFrame(frameId)
      disconnectSpy?.()
      window.removeEventListener('hashchange', onHashChange)
      if (navLockTimerRef.current !== null) {
        window.clearTimeout(navLockTimerRef.current)
      }
    }
  }, [isHome, location.hash])

  function handleSectionNavClick(sectionId: HomeSectionId) {
    setActiveSectionId(sectionId)
    lockNavUpdates()
    scrollToHomeSection(sectionId)
    window.history.pushState(null, '', homeSectionHref(sectionId))
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Logo className="navbar-logo" size="md" />

        {isHome && (
          <nav className="navbar-links" aria-label="Page sections">
            {HOME_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={homeSectionHref(section.id)}
                className={activeSectionId === section.id ? 'active' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  handleSectionNavClick(section.id)
                }}
              >
                {section.label}
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
