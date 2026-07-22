import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../utils/constants'
import {
  canCreateContent,
  canManageGroups,
  getRoleLabel,
  getUserFirstName,
  getWorkspaceTitle,
} from '../utils/roles'
import { Logo } from '../components/Logo'
import { ProfileMenu } from '../components/ProfileMenu'
import { SettingsIcon } from '../components/icons'
import './dashboard-layout.css'

const SIDEBAR_STATE_KEY = 'classroomai.sidebar.collapsed'

type NavItem = {
  label: string
  to: string
  icon: ReactNode
  end?: boolean
}

type NavSection = {
  title?: string
  items: NavItem[]
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <span className="dash-nav-icon" aria-hidden="true">
      {children}
    </span>
  )
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
      <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
      <path
        d="M5 5.5h5.5v13H5a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 5 5.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M10.5 5.5H19a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-8.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M8 9h2M8 12h2M14 9h3M14 12h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
      <path d="M12 16V5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="m8 9 4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 19h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4 19c0-2.5 2.2-4 5-4s5 1.5 5 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15.5 19c.3-1.8 1.7-3 3.5-3s3.2 1.2 3.5 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
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

function SettingsNavIcon() {
  return <SettingsIcon className="dash-nav-svg" />
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dash-nav-svg">
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

const BACK_TO_HOME_ITEM: NavItem = {
  label: 'Back to Home',
  to: ROUTES.home,
  icon: <HomeIcon />,
  end: true,
}

const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { label: 'Profile', to: ROUTES.profile, icon: <ProfileIcon /> },
  { label: 'Settings', to: ROUTES.settings, icon: <SettingsNavIcon /> },
]

function buildNavSections(user: ReturnType<typeof useAuth>['user']): NavSection[] {
  if (!canCreateContent(user)) {
    return [
      {
        title: 'LEARN',
        items: [{ label: 'My Lessons', to: ROUTES.dashboard, icon: <DashboardIcon /> }],
      },
      {
        title: 'Account',
        items: ACCOUNT_NAV_ITEMS,
      },
    ]
  }

  const learnItems: NavItem[] = [
    { label: 'Dashboard', to: ROUTES.dashboard, icon: <DashboardIcon /> },
    { label: 'Library', to: ROUTES.library, icon: <LibraryIcon /> },
    { label: 'Upload', to: ROUTES.upload, icon: <UploadIcon /> },
  ]

  const sections: NavSection[] = [
    {
      title: 'LEARN',
      items: learnItems,
    },
  ]

  if (canManageGroups(user)) {
    sections.push({
      title: 'Student Groups',
      items: [{ label: 'Groups', to: ROUTES.groups, icon: <GroupsIcon /> }],
    })
  }

  sections.push({
    title: 'Account',
    items: ACCOUNT_NAV_ITEMS,
  })

  return sections
}

export function DashboardLayout() {
  const { user } = useAuth()
  const navSections = buildNavSections(user)
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
  const firstName = getUserFirstName(user)
  const workspaceTitle = getWorkspaceTitle(user)
  const roleLabel = getRoleLabel(user)

  return (
    <div className={`dash ${collapsed ? 'dash-collapsed' : ''}`}>
      <header className="dash-header">
        <div className="dash-header-brand">
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

        <div className="dash-topbar">
          <div className="dash-topbar-intro">
            <h1 className="dash-topbar-title">{workspaceTitle}</h1>
            <p className="dash-topbar-welcome">
              Welcome back, <span>{firstName}</span>
            </p>
          </div>

          <div className="dash-topbar-actions">
            <button type="button" className="dash-topbar-notify" aria-label="Notifications">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3a5 5 0 0 1 5 5v2.1c0 .5.2 1 .5 1.4L18.5 14H5.5l1-2.5c.3-.4.5-.9.5-1.4V8a5 5 0 0 1 5-5Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>

            <ProfileMenu
              initials={initials}
              displayName={firstName}
              roleLabel={roleLabel}
            />
          </div>
        </div>
      </header>

      <aside className="dash-sidebar" aria-label="Sidebar navigation">
        <nav className="dash-nav">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title ?? `section-${sectionIndex}`} className="dash-nav-section">
              {section.title && (
                <p className="dash-nav-section-label">{section.title}</p>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className="dash-nav-link"
                  title={item.label}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  <span className="dash-nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="dash-sidebar-bottom">
          <NavLink
            to={BACK_TO_HOME_ITEM.to}
            end={BACK_TO_HOME_ITEM.end}
            className="dash-nav-link"
            title={BACK_TO_HOME_ITEM.label}
          >
            <NavIcon>{BACK_TO_HOME_ITEM.icon}</NavIcon>
            <span className="dash-nav-label">{BACK_TO_HOME_ITEM.label}</span>
          </NavLink>
        </div>
      </aside>

      <div className="dash-main">
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default DashboardLayout
