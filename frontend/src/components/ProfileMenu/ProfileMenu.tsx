import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../utils/constants'
import { SettingsIcon } from '../icons'
import './ProfileMenu.css'

type ProfileMenuProps = {
  initials: string
  displayName: string
  roleLabel: string
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-profile-menu-icon" aria-hidden="true">
      <path
        d="M5 10.5 12 5l7 5.5V19a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 20.5V14h4v6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-profile-menu-icon" aria-hidden="true">
      <path
        d="M12 3l1.4 2.8 3.1.5-2.2 2.2.5 3.1L12 10.2 9.2 11.6l.5-3.1-2.2-2.2 3.1-.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-profile-menu-icon" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-profile-menu-icon" aria-hidden="true">
      <path
        d="M10 7V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M14 12H4m0 0 3-3M4 12l3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProfileMenu({ initials, displayName, roleLabel }: ProfileMenuProps) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function close() {
    setOpen(false)
  }

  function handleNavigate(path: string) {
    close()
    navigate(path)
  }

  return (
    <div className="dash-profile-menu" ref={menuRef}>
      <button
        type="button"
        className={`dash-topbar-user${open ? ' dash-topbar-user-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="dash-topbar-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="dash-topbar-user-meta">
          <span className="dash-topbar-user-name">{displayName}</span>
          <span className="dash-topbar-user-role">{roleLabel}</span>
        </span>
        <svg
          className={`dash-topbar-chevron${open ? ' dash-topbar-chevron-open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="dash-profile-dropdown" role="menu">
          <button
            type="button"
            className="dash-profile-dropdown-item"
            role="menuitem"
            onClick={() => handleNavigate(ROUTES.dashboard)}
          >
            <WorkspaceIcon />
            My Workspace
          </button>
          <button
            type="button"
            className="dash-profile-dropdown-item"
            role="menuitem"
            onClick={() => handleNavigate(ROUTES.profile)}
          >
            <ProfileIcon />
            Profile
          </button>
          <button
            type="button"
            className="dash-profile-dropdown-item"
            role="menuitem"
            onClick={() => handleNavigate(ROUTES.settings)}
          >
            <SettingsIcon className="dash-profile-menu-icon" />
            Settings
          </button>
          <button
            type="button"
            className="dash-profile-dropdown-item"
            role="menuitem"
            onClick={() => handleNavigate(ROUTES.home)}
          >
            <HomeIcon />
            Back to Home
          </button>
          <div className="dash-profile-dropdown-divider" role="separator" />
          <button
            type="button"
            className="dash-profile-dropdown-item dash-profile-dropdown-item-danger"
            role="menuitem"
            onClick={() => {
              close()
              logout()
            }}
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
