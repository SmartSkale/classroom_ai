import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { getEmailError, getPasswordError } from '../../utils/validators'
import {
  ROUTES,
  SIGNUP_ROLE_OPTIONS,
  TOKEN_STORAGE_KEY,
  type UserRole,
} from '../../utils/constants'
import './Login.css'

type Mode = 'login' | 'register'

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

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, status, error } = useAuth()

  const requestedMode = (location.state as { mode?: Mode; from?: string } | null)?.mode
  const returnTo = (location.state as { from?: string } | null)?.from
  const [mode, setMode] = useState<Mode>(requestedMode === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const submitting = status === 'loading'
  const isLogin = mode === 'login'

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setFieldError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const emailErr = getEmailError(email)
    const passwordErr = getPasswordError(password)
    if (emailErr || passwordErr) {
      setFieldError(emailErr ?? passwordErr)
      return
    }
    if (!isLogin && !fullName.trim()) {
      setFieldError('Please enter your full name.')
      return
    }
    setFieldError(null)

    if (isLogin) {
      await login(email, password)
    } else {
      await register({ email, password, full_name: fullName.trim(), role })
    }

    if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
      navigate(returnTo || ROUTES.dashboard)
    }
  }

  return (
    <div className="login">
      <div className="login-mode-toggle" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={isLogin}
          className={`login-mode-btn ${isLogin ? 'login-mode-btn-active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLogin}
          className={`login-mode-btn ${!isLogin ? 'login-mode-btn-active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Sign up
        </button>
      </div>

      <h1 className="login-title">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p className="login-sub">
        {isLogin
          ? 'Sign in to pick up where you left off.'
          : 'Register for free — no credit card required.'}
      </p>

      <form className="login-form" onSubmit={handleSubmit}>
        {!isLogin && (
          <>
            <fieldset className="login-roles">
              <legend>I want to…</legend>
              <div className="login-roles-grid" role="radiogroup" aria-label="Select your role">
                {SIGNUP_ROLE_OPTIONS.map((option) => {
                  const selected = role === option.id
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={`role-card ${selected ? 'role-card-selected' : ''}`}
                      onClick={() => setRole(option.id)}
                      role="radio"
                      aria-checked={selected}
                    >
                      {selected && (
                        <span className="role-card-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                      <span className="role-card-icon" aria-hidden="true">
                        {option.icon}
                      </span>
                      <span className="role-card-title">{option.title}</span>
                      <span className="role-card-desc">{option.description}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <label className="login-field">
              <span>Your name</span>
              <input
                className="login-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                required
              />
            </label>
          </>
        )}

        <label className="login-field">
          <span>Email address</span>
          <div className="login-input-wrap">
            <MailIcon />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </label>

        <label className="login-field">
          <span>Password</span>
          <div className="login-input-wrap login-input-wrap-password">
            <LockIcon />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
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
        </label>

        {isLogin && (
          <div className="login-forgot-wrap">
            <button type="button" className="login-forgot">
              Forgot password?
            </button>
          </div>
        )}

        {(fieldError || error) && <p className="login-error">{fieldError ?? error}</p>}

        <Button type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
        </Button>
      </form>

      <p className="login-switch">
        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          className="login-link"
          onClick={() => switchMode(isLogin ? 'register' : 'login')}
        >
          {isLogin ? 'Create an account' : 'Log in'}
        </button>
      </p>
    </div>
  )
}

export default Login
