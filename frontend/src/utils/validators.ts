const EMAIL_LOCAL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/
const EMAIL_DOMAIN_RE =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
const PASSWORD_UPPER_RE = /[A-Z]/
const PASSWORD_DIGIT_RE = /\d/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > 254) return false

  const atIndex = email.lastIndexOf('@')
  if (atIndex <= 0 || atIndex > 64) return false

  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (!local || !domain || domain.length > 253) return false
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false
  if (!EMAIL_LOCAL_RE.test(local)) return false
  if (!EMAIL_DOMAIN_RE.test(domain)) return false

  const labels = domain.split('.')
  if (labels.some((label) => label.length < 2)) return false

  const tld = labels[labels.length - 1]
  if (!/^[a-zA-Z]+$/.test(tld)) return false
  // Reject partial domains like user@gmail.co; allow multi-part domains like bbc.co.uk.
  if (tld.length < 3 && labels.length < 3) return false
  if (tld.length < 2) return false

  return true
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
  if (!isValidEmail(value)) return 'Enter a valid email address (e.g. you@example.com).'
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

export function getNewPasswordDifferentError(
  newPassword: string,
  currentPassword: string,
): string | null {
  if (newPassword && currentPassword && newPassword === currentPassword) {
    return 'New password must be different from your current password.'
  }
  return null
}
