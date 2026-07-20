import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../utils/constants'
import { canCreateContent, canManageGroups } from '../utils/roles'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/Logo'
import './dashboard-layout.css'

const SIDEBAR_STATE_KEY = 'classroomai.sidebar.collapsed'

const TEACHER_NAV = [
  { label: 'Home', to: ROUTES.home, icon: '🏠', end: true },
  { label: 'Dashboard', to: ROUTES.dashboard, icon: '▤', end: false },
  { label: 'Library', to: ROUTES.library, icon: '📚', end: false },
  { label: 'Groups', to: ROUTES.groups, icon: '👥', end: false },
  { label: 'Upload', to: ROUTES.upload, icon: '⬆️', end: false },
  { label: 'Profile', to: ROUTES.profile, icon: '👤', end: false },
]

const STUDENT_NAV = [
  { label: 'Home', to: ROUTES.home, icon: '🏠', end: true },
  { label: 'My Lessons', to: ROUTES.dashboard, icon: '▤', end: false },
  { label: 'Profile', to: ROUTES.profile, icon: '👤', end: false },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navItems = canCreateContent(user)
    ? canManageGroups(user)
      ? TEACHER_NAV
      : TEACHER_NAV.filter((item) => item.to !== ROUTES.groups)
    : STUDENT_NAV
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_STATE_KEY) === '1',
  )

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STATE_KEY, next ? '1' : '0')
      return next
    })
  }

  const initials = (user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()

  return (
    <div className={`dash ${collapsed ? 'dash-collapsed' : ''}`}>
      <aside className="dash-sidebar" aria-label="Sidebar navigation">
        <div className="dash-sidebar-top">
          <Logo className="dash-brand" to={ROUTES.dashboard} compact={collapsed} />
          <button
            className="dash-collapse-btn"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="dash-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className="dash-nav-link"
              title={item.label}
            >
              <span className="dash-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="dash-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dash-sidebar-bottom">
          <ThemeToggle />
          <div className="dash-user" title={user?.email}>
            <span className="dash-user-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="dash-user-name">{user?.full_name || user?.email}</span>
          </div>
          <button className="dash-logout" onClick={logout} title="Log out">
            <span className="dash-nav-icon" aria-hidden="true">
              ⏻
            </span>
            <span className="dash-nav-label">Log out</span>
          </button>
        </div>
      </aside>

      <div className="dash-content">
        <Outlet />
      </div>
    </div>
  )
}

export default DashboardLayout
