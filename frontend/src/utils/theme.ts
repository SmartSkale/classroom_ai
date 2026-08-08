export const THEME_STORAGE_KEY = 'classroomai.theme'

export type Theme = 'light' | 'dark'

const THEME_COLORS: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#000000',
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[theme])
}

export function initTheme(): void {
  applyTheme(getStoredTheme())
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }))
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}
