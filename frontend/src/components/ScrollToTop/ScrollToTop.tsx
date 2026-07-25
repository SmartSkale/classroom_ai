import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll position when navigating between routes. */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    const dashMain = document.querySelector<HTMLElement>('.dash-main')
    if (dashMain) {
      dashMain.scrollTo(0, 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname])

  return null
}

export default ScrollToTop
