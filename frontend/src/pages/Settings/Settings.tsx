import { useState } from 'react'
import { Button } from '../../components/Button'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { getApiErrorMessage } from '../../utils/apiErrors'
import {
  getConfirmPasswordError,
  getNewPasswordError,
} from '../../utils/validators'
import '../Profile/Profile.css'
import './Settings.css'

export function Settings() {
  const { changePassword, logout } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

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
    <div className="profile settings">
      <header className="profile-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">Manage appearance and account security.</p>
      </header>

      <section className="profile-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="profile-section-title">
          Appearance
        </h2>
        <p className="profile-appearance-hint">Choose light or dark mode for the app interface.</p>
        <ThemeToggle />
      </section>

      <section className="profile-section" aria-labelledby="password-heading">
        <h2 id="password-heading" className="profile-section-title">
          Change password
        </h2>

        <label className="profile-field" htmlFor="settings-current-password">
          <span>Current password</span>
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setPasswordMessage(null)
            }}
            autoComplete="current-password"
          />
        </label>

        <label className="profile-field" htmlFor="settings-new-password">
          <span>New password</span>
          <input
            id="settings-new-password"
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
          <label className="profile-field" htmlFor="settings-confirm-password">
            <span>Confirm new password</span>
            <input
              id="settings-confirm-password"
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
            {passwordSaving ? 'Updating…' : 'Update password'}
          </Button>
        </div>
        {passwordMessage && (
          <p className={`profile-feedback profile-feedback-${passwordMessage.type}`} role="status">
            {passwordMessage.text}
          </p>
        )}
      </section>

      <section className="profile-section settings-account" aria-labelledby="account-heading">
        <h2 id="account-heading" className="settings-account-title">
          <ShieldIcon />
          Account
        </h2>
        <button type="button" className="settings-logout-btn" onClick={logout}>
          <LogoutIcon />
          Logout
        </button>
      </section>
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="settings-account-icon" aria-hidden="true">
      <path
        d="M12 3 5 6v6c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="settings-logout-icon" aria-hidden="true">
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

export default Settings
