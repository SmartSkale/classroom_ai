const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_UPPER_RE = /[A-Z]/
const PASSWORD_DIGIT_RE = /\d/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8
}

export function isValidNewPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    PASSWORD_UPPER_RE.test(value) &&
    PASSWORD_DIGIT_RE.test(value)
  )
}

export function getEmailError(value: string): string | null {
  if (!value.trim()) return 'Email is required.'
  if (!isValidEmail(value)) return 'Enter a valid email address.'
  return null
}

export function getFullNameError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Full name is required.'
  if (trimmed.length < 2) return 'Full name must be at least 2 characters.'
  if (trimmed.length > 80) return 'Full name must be at most 80 characters.'
  return null
}

export function getPasswordError(value: string): string | null {
  if (!value) return 'Password is required.'
  if (!isValidPassword(value)) return 'Password must be at least 8 characters.'
  return null
}

export function getNewPasswordError(value: string): string | null {
  if (!value) return 'New password is required.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  if (!PASSWORD_UPPER_RE.test(value)) {
    return 'Password must contain at least one uppercase letter.'
  }
  if (!PASSWORD_DIGIT_RE.test(value)) {
    return 'Password must contain at least one number.'
  }
  return null
}

export function getConfirmPasswordError(value: string, newPassword: string): string | null {
  if (!value) return 'Please confirm your new password.'
  if (value !== newPassword) return 'Passwords do not match.'
  return null
}
