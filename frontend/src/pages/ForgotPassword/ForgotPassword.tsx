import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import authService from '../../services/authService'
import { getEmailError, isValidEmail, normalizeEmail, verifyEmailDeliverable } from '../../utils/validators'
import { getApiErrorMessage } from '../../utils/apiErrors'
import { ROUTES } from '../../utils/constants'
import '../Login/Login.css'

function MailIcon() {
  return (
    <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

const RESET_LINK_EXPIRE_MINUTES = 30

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const emailErr = getEmailError(email)
    setEmailError(emailErr)
    if (emailErr) return

    const deliverabilityErr = await verifyEmailDeliverable(email)
    if (deliverabilityErr) {
      setEmailError(deliverabilityErr)
      return
    }

    const normalizedEmail = normalizeEmail(email)
    setSubmitting(true)
    setError(null)
    try {
      await authService.requestPasswordReset(normalizedEmail)
      setSentEmail(normalizedEmail)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send reset link. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const canSendReset = isValidEmail(email)

  if (sentEmail) {
    return (
      <div className="login login-reset-sent-page">
        <h1 className="login-title">Check your email</h1>
        <p className="login-reset-sent">
          If an account exists for <strong>{sentEmail}</strong>, we&apos;ve sent a password reset
          link. The link will expire in {RESET_LINK_EXPIRE_MINUTES} minutes.
        </p>
        <p className="login-reset-sent-hint">
          Didn&apos;t receive it? Check your spam folder, or wait a minute and try again.
        </p>
        <div className="login-back-footer login-back-footer-sent">
          <Link className="login-back" to={ROUTES.login}>
            <span className="login-back-arrow" aria-hidden="true">
              ←
            </span>
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="login">
      <h1 className="login-title">Forgot password?</h1>
      <p className="login-sub">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span>Email address</span>
            <div className="login-input-wrap">
              <MailIcon />
              <input
                type="email"
                className={emailError ? 'login-input-invalid' : ''}
                value={email}
                onChange={(e) => {
                  const next = e.target.value
                  setEmail(next)
                  if (emailError || (next.includes('@') && next.includes('.'))) {
                    setEmailError(getEmailError(next) || null)
                  } else if (!next.includes('@')) {
                    setEmailError(null)
                  }
                }}
                onBlur={() => setEmailError(getEmailError(email))}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(emailError)}
                required
              />
            </div>
            {emailError && <p className="login-field-error">{emailError}</p>}
          </label>

          {error && <p className="login-error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            className="login-reset-btn"
            disabled={!canSendReset || submitting}
          >
            {submitting ? 'Sending…' : 'Send reset link'}
            {!submitting && (
              <span className="login-reset-btn-icon" aria-hidden="true">
                →
              </span>
            )}
          </Button>
      </form>

      <div className="login-back-footer">
        <Link className="login-back login-back-plain" to={ROUTES.login}>
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default ForgotPassword
