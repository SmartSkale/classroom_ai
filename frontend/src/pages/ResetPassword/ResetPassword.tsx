import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import authService from '../../services/authService'
import {
  getConfirmPasswordError,
  getNewPasswordError,
} from '../../utils/validators'
import { getApiErrorMessage } from '../../utils/apiErrors'
import { ROUTES } from '../../utils/constants'
import '../Login/Login.css'

function LockIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8 11V8a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  }

  return (
    <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M10.6 10.6A2.5 2.5 0 0 0 12 15a2.5 2.5 0 0 0 1.4-.4M7.2 7.2C8.6 6.3 10.2 6 12 6c5.5 0 9 6 9 6a15.5 15.5 0 0 1-3.1 3.8M5.1 9.1C4.1 10 3 12 3 12s3.5 6 9 6c.9 0 1.7-.1 2.5-.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return <Navigate to={ROUTES.forgotPassword} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const passwordErr = getNewPasswordError(password)
    const confirmErr = getConfirmPasswordError(confirmPassword, password)
    setPasswordError(passwordErr)
    setConfirmError(confirmErr)
    if (passwordErr || confirmErr) return

    setSubmitting(true)
    setError(null)
    try {
      const { message: responseMessage } = await authService.resetPassword({
        token,
        new_password: password,
        confirm_password: confirmPassword,
      })
      setMessage(responseMessage)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reset your password. Please request a new link.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login">
      <h1 className="login-title">Reset password</h1>
      <p className="login-sub">Choose a new password for your account.</p>

      {message ? (
        <div className="login-success" role="status">
          <p>{message}</p>
          <Link className="login-link" to={ROUTES.login}>
            Go to log in
          </Link>
        </div>
      ) : (
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span>New password</span>
            <div className="login-input-wrap login-input-wrap-password">
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                className={passwordError ? 'login-input-invalid' : ''}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) setPasswordError(getNewPasswordError(e.target.value))
                }}
                onBlur={() => setPasswordError(getNewPasswordError(password))}
                placeholder="Your new password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon hidden={!showPassword} />
              </button>
            </div>
            {passwordError && <p className="login-field-error">{passwordError}</p>}
          </label>

          <label className="login-field">
            <span>Confirm password</span>
            <div className="login-input-wrap login-input-wrap-password">
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                className={confirmError ? 'login-input-invalid' : ''}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (confirmError) {
                    setConfirmError(getConfirmPasswordError(e.target.value, password))
                  }
                }}
                onBlur={() => setConfirmError(getConfirmPasswordError(confirmPassword, password))}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                aria-invalid={Boolean(confirmError)}
                required
              />
            </div>
            {confirmError && <p className="login-field-error">{confirmError}</p>}
          </label>

          {error && <p className="login-error">{error}</p>}

          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Saving…' : 'Reset password'}
          </Button>
        </form>
      )}

      {!message && (
        <p className="login-switch">
          <Link className="login-link" to={ROUTES.forgotPassword}>
            Request a new link
          </Link>
        </p>
      )}
    </div>
  )
}

export default ResetPassword
