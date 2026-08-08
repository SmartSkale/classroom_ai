import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '../../utils/constants'
import { scrollToHomeSectionWhenReady } from '../../utils/homeSections'

/** Reset scroll on route changes; honor home-page section hashes. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (pathname === ROUTES.home && hash) {
      scrollToHomeSectionWhenReady(hash.slice(1))
      return
    }

    const dashMain = document.querySelector<HTMLElement>('.dash-main')
    if (dashMain) {
      dashMain.scrollTo(0, 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}

export default ScrollToTop
