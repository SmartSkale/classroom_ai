import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { projectService, type Usage } from '../../services/projectService'
import { userService } from '../../services/userService'
import type { User } from '../../services/authService'
import { ROUTES, USER_ROLES } from '../../utils/constants'
import { getApiErrorMessage } from '../../utils/apiErrors'
import { getRoleLabel } from '../../utils/roles'
import { getEmailError, getFullNameError } from '../../utils/validators'
import './Profile.css'

function getInitials(user: User): string {
  if (user.full_name?.trim()) {
    const parts = user.full_name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return user.email.slice(0, 1).toUpperCase()
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPlan(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export function Profile() {
  const navigate = useNavigate()
  const { user, updateProfile } = useAuth()
  const isAdmin = user?.role === USER_ROLES.admin
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchUsage = useCallback(() => projectService.getUsage(), [])
  const { data: usage } = useFetch<Usage>(fetchUsage)

  const fetchUsers = useCallback<() => Promise<User[]>>(
    () => (isAdmin ? userService.listUsers() : Promise.resolve([])),
    [isAdmin],
  )
  const { data: users, loading: usersLoading, error: usersError } = useFetch<User[]>(fetchUsers, [isAdmin])

  useEffect(() => {
    if (!user) return
    setFullName(user.full_name ?? '')
    setEmail(user.email)
  }, [user])

  if (!user) return <Loader fullscreen label="Loading profile…" />

  const initials = getInitials(user)
  const displayName = user.full_name?.trim() || user.email.split('@')[0]
  const roleAccountLabel = `${getRoleLabel(user)} ACCOUNT`
  const isDirty =
    fullName.trim() !== (user.full_name ?? '').trim() ||
    email.trim().toLowerCase() !== user.email.toLowerCase()

  function resetForm() {
    if (!user) return
    setFullName(user.full_name ?? '')
    setEmail(user.email)
    setMessage(null)
  }

  function handleCancelEdit() {
    resetForm()
    setIsEditing(false)
  }

  function handleAvatarChange(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!user) return

    const nameError = getFullNameError(fullName)
    if (nameError) {
      setMessage({ type: 'error', text: nameError })
      return
    }

    const emailError = getEmailError(email)
    if (emailError) {
      setMessage({ type: 'error', text: emailError })
      return
    }

    if (!isDirty) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const payload: { full_name?: string; email?: string } = {}
      if (fullName.trim() !== (user.full_name ?? '').trim()) {
        payload.full_name = fullName.trim()
      }
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
        payload.email = email.trim()
      }
      await updateProfile(payload)
      setMessage({ type: 'success', text: 'Profile updated.' })
      setIsEditing(false)
    } catch (err) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Could not update your profile. Try again.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile">
      <header className="profile-header">
        <h1>My Profile</h1>
      </header>

      <section className="profile-info-card" aria-labelledby="profile-info-heading">
        <div className="profile-info-card-header">
          <h2 id="profile-info-heading" className="profile-info-card-title">
            <PersonIcon />
            Profile Information
          </h2>
          {!isEditing ? (
            <button type="button" className="profile-edit-btn" onClick={() => setIsEditing(true)}>
              <PencilIcon />
              Edit
            </button>
          ) : (
            <div className="profile-edit-actions">
              <button type="button" className="profile-edit-btn profile-edit-btn-muted" onClick={handleCancelEdit}>
                Cancel
              </button>
              <button
                type="button"
                className="profile-edit-btn profile-edit-btn-save"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="profile-info-hero">
          {isEditing ? (
            <button
              type="button"
              className="profile-info-avatar-btn"
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Upload profile photo"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="profile-info-avatar-image" />
              ) : (
                <span className="profile-info-avatar-initials" aria-hidden="true">
                  {initials}
                </span>
              )}
            </button>
          ) : (
            <div className="profile-info-avatar" aria-hidden="true">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="profile-info-avatar-image" />
              ) : (
                <span className="profile-info-avatar-initials">{initials}</span>
              )}
            </div>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="profile-avatar-input"
            onChange={(e) => handleAvatarChange(e.target.files?.[0])}
          />
          <div className="profile-info-hero-text">
            <p className="profile-info-name">{displayName}</p>
            <p className="profile-info-role">{roleAccountLabel}</p>
          </div>
        </div>

        <div className="profile-info-grid">
          <div className="profile-info-field">
            <span className="profile-info-label">Full Name</span>
            {isEditing ? (
              <input
                id="profile-full-name"
                className="profile-info-input"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  setMessage(null)
                }}
                autoComplete="name"
              />
            ) : (
              <span className="profile-info-value">
                <PersonSmallIcon />
                {user.full_name?.trim() || 'Not provided'}
              </span>
            )}
          </div>

          <div className="profile-info-field">
            <span className="profile-info-label">Email</span>
            {isEditing ? (
              <input
                id="profile-email"
                className="profile-info-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setMessage(null)
                }}
                autoComplete="email"
              />
            ) : (
              <span className="profile-info-value">
                <EmailIcon />
                {user.email}
              </span>
            )}
          </div>

        </div>

        {message && (
          <p className={`profile-feedback profile-feedback-${message.type}`} role="status">
            {message.text}
          </p>
        )}
      </section>

      <section className="profile-section profile-plan" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="profile-section-title">
          Plan &amp; usage
        </h2>
        <div className="profile-plan-summary">
          <p className="profile-plan-label">
            Plan: <strong>{formatPlan(usage?.plan ?? 'free')}</strong>
            {usage && (
              <>
                {' '}
                | <strong>{usage.used}</strong>/{usage.limit} generations used
              </>
            )}
          </p>
          {usage && (
            <div className="profile-usage-bar" aria-hidden="true">
              <div
                className="profile-usage-fill"
                style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
              />
            </div>
          )}
        </div>
        <Button variant="primary" onClick={() => navigate(ROUTES.billing)}>
          Upgrade Plan
        </Button>
      </section>

      {isAdmin && (
        <section className="profile-section profile-admin" aria-labelledby="admin-users-heading">
          <h2 id="admin-users-heading" className="profile-section-title">
            All users
          </h2>
          {usersLoading && <Loader label="Loading users…" />}
          {usersError && <p className="profile-feedback profile-feedback-error">{usersError}</p>}
          {users && users.length > 0 && (
            <ul className="profile-user-list">
              {users.map((u) => (
                <li key={u.id}>
                  <span>{u.full_name || u.email}</span>
                  <span className="profile-badge">{formatRole(u.role)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="profile-info-title-icon" aria-hidden="true">
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="profile-edit-btn-icon" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12L15.62 4.5a1.5 1.5 0 0 0-2.12 0L3 15v5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function PersonSmallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="profile-info-value-icon" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6 19c0-2.5 2.2-4 6-4s6 1.5 6 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="profile-info-value-icon" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  )
}

export default Profile
