import { useCallback, useEffect, useState } from 'react'
import { getStoredTheme, setTheme, toggleTheme, type Theme } from '../utils/theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    function onThemeChange(event: Event) {
      const detail = (event as CustomEvent<Theme>).detail
      if (detail === 'light' || detail === 'dark') {
        setThemeState(detail)
      }
    }

    window.addEventListener('themechange', onThemeChange)
    return () => window.removeEventListener('themechange', onThemeChange)
  }, [])

  const selectTheme = useCallback((next: Theme) => {
    setTheme(next)
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setThemeState(toggleTheme())
  }, [])

  return { theme, setTheme: selectTheme, toggleTheme: toggle }
}
