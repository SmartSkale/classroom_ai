import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { projectService, type Usage } from '../../services/projectService'
import { userService } from '../../services/userService'
import type { User } from '../../services/authService'
import { ROUTES, USER_ROLES } from '../../utils/constants'
import {
  getConfirmPasswordError,
  getEmailError,
  getFullNameError,
  getNewPasswordError,
} from '../../utils/validators'
import './Profile.css'

function getInitials(user: User): string {
  if (user.full_name?.trim()) {
    const parts = user.full_name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return user.email.slice(0, 2).toUpperCase()
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

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      return String(detail[0].msg).replace(/^Value error,\s*/i, '')
    }
  }
  return fallback
}

export function Profile() {
  const navigate = useNavigate()
  const { user, updateProfile, changePassword } = useAuth()
  const isAdmin = user?.role === USER_ROLES.admin
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [nameSaving, setNameSaving] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
  const nameDirty = fullName.trim() !== (user.full_name ?? '').trim()
  const emailDirty = email.trim().toLowerCase() !== user.email.toLowerCase()

  function handleAvatarChange(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSaveName() {
    const error = getFullNameError(fullName)
    if (error) {
      setNameMessage({ type: 'error', text: error })
      return
    }
    if (!nameDirty) return

    setNameSaving(true)
    setNameMessage(null)
    try {
      await updateProfile({ full_name: fullName.trim() })
      setNameMessage({ type: 'success', text: 'Profile updated.' })
    } catch (err) {
      setNameMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Could not update your name. Try again.'),
      })
    } finally {
      setNameSaving(false)
    }
  }

  async function handleSaveEmail() {
    const error = getEmailError(email)
    if (error) {
      setEmailMessage({ type: 'error', text: error })
      return
    }
    if (!emailDirty) return

    setEmailSaving(true)
    setEmailMessage(null)
    try {
      await updateProfile({ email: email.trim() })
      setEmailMessage({ type: 'success', text: 'Profile updated.' })
    } catch (err) {
      setEmailMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Could not update your email. Try again.'),
      })
    } finally {
      setEmailSaving(false)
    }
  }

  async function handleChangePassword() {
    const currentErr = !currentPassword ? 'Current password is required.' : null
    const newErr = getNewPasswordError(newPassword)
    const confirmErr = getConfirmPasswordError(confirmPassword, newPassword)
    const firstError = currentErr ?? newErr ?? confirmErr
    if (firstError) {
      setPasswordMessage({ type: 'error', text: firstError })
      return
    }

    setPasswordSaving(true)
    setPasswordMessage(null)
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage({ type: 'success', text: 'Password changed successfully.' })
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: getApiErrorMessage(err, 'Could not change your password. Try again.'),
      })
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="profile">
      <header className="profile-header">
        <h1>My Profile</h1>
      </header>

      <section className="profile-identity" aria-label="Profile summary">
        <button
          type="button"
          className="profile-avatar-btn"
          onClick={() => avatarInputRef.current?.click()}
          aria-label="Upload profile photo"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="" className="profile-avatar-image" />
          ) : (
            <span className="profile-avatar-initials" aria-hidden="true">
              {initials}
            </span>
          )}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="profile-avatar-input"
          onChange={(e) => handleAvatarChange(e.target.files?.[0])}
        />
        <div className="profile-identity-text">
          <h2 className="profile-display-name">{user.full_name || user.email}</h2>
          <p className="profile-email">{user.email}</p>
          <p className="profile-role">
            Role: <span className="profile-badge">{formatRole(user.role)}</span>
          </p>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-fields-heading">
        <h2 id="profile-fields-heading" className="profile-section-title">
          Personal details
        </h2>

        <div className="profile-field-row">
          <label className="profile-field" htmlFor="profile-full-name">
            <span>Full Name</span>
            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setNameMessage(null)
              }}
              autoComplete="name"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSaveName()}
            disabled={!nameDirty || nameSaving}
          >
            {nameSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {nameMessage && (
          <p className={`profile-feedback profile-feedback-${nameMessage.type}`} role="status">
            {nameMessage.text}
          </p>
        )}

        <div className="profile-field-row">
          <label className="profile-field" htmlFor="profile-email">
            <span>Email</span>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailMessage(null)
              }}
              autoComplete="email"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSaveEmail()}
            disabled={!emailDirty || emailSaving}
          >
            {emailSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {emailMessage && (
          <p className={`profile-feedback profile-feedback-${emailMessage.type}`} role="status">
            {emailMessage.text}
          </p>
        )}
      </section>

      <section className="profile-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="profile-section-title">
          Appearance
        </h2>
        <p className="profile-appearance-hint">Choose light or dark mode for the app interface.</p>
        <ThemeToggle />
      </section>

      <section className="profile-section" aria-labelledby="password-heading">
        <h2 id="password-heading" className="profile-section-title">
          Change Password
        </h2>

        <label className="profile-field" htmlFor="profile-current-password">
          <span>Current Password</span>
          <input
            id="profile-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setPasswordMessage(null)
            }}
            autoComplete="current-password"
          />
        </label>

        <label className="profile-field" htmlFor="profile-new-password">
          <span>New Password</span>
          <input
            id="profile-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setPasswordMessage(null)
            }}
            autoComplete="new-password"
          />
        </label>

        <div className="profile-field-row">
          <label className="profile-field" htmlFor="profile-confirm-password">
            <span>Confirm</span>
            <input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setPasswordMessage(null)
              }}
              autoComplete="new-password"
            />
          </label>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleChangePassword()}
            disabled={passwordSaving}
          >
            {passwordSaving ? 'Updating…' : 'Update'}
          </Button>
        </div>
        {passwordMessage && (
          <p className={`profile-feedback profile-feedback-${passwordMessage.type}`} role="status">
            {passwordMessage.text}
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

export default Profile
