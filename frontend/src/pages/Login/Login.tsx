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

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, status, error } = useAuth()

  // Allow callers (e.g. the "Register" button) to open this page directly in
  // register mode via navigation state.
  const requestedMode = (location.state as { mode?: Mode; from?: string } | null)?.mode
  const returnTo = (location.state as { from?: string } | null)?.from
  const [mode, setMode] = useState<Mode>(requestedMode === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const submitting = status === 'loading'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const emailErr = getEmailError(email)
    const passwordErr = getPasswordError(password)
    if (emailErr || passwordErr) {
      setFieldError(emailErr ?? passwordErr)
      return
    }
    if (mode === 'register' && !fullName.trim()) {
      setFieldError('Please enter your full name.')
      return
    }
    setFieldError(null)

    if (mode === 'login') {
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
      <h1 className="login-title">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="login-sub">
        {mode === 'login'
          ? 'Log in to access your lessons and quizzes.'
          : 'Register for free — no credit card required.'}
      </p>

      <form className="login-form" onSubmit={handleSubmit}>
        {mode === 'register' && (
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
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu"
            autoComplete="email"
            required
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
        </label>

        {(fieldError || error) && <p className="login-error">{fieldError ?? error}</p>}

        <Button type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}
        </Button>
      </form>

      <p className="login-switch">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button
          type="button"
          className="login-link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setFieldError(null)
          }}
        >
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </button>
      </p>
    </div>
  )
}

export default Login
