export const HOME_SECTIONS = [
  { label: 'Teacher Journey', id: 'how-it-works' },
  { label: 'Parent Journey', id: 'parent-journey' },
  { label: 'Student Journey', id: 'student-journey' },
  { label: 'Features', id: 'features' },
] as const

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id']

export function homeSectionHref(sectionId: HomeSectionId): string {
  return `#${sectionId}`
}

function getNavbarHeightPx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 68
}

/** Scroll a home-page section into view below the sticky navbar. */
export function scrollToHomeSection(sectionId: string, behavior: ScrollBehavior = 'smooth'): boolean {
  const el = document.getElementById(sectionId)
  if (!el) return false
  el.scrollIntoView({ behavior, block: 'start' })
  return true
}

/** Retry scrolling until the target section is mounted (e.g. after route render). */
export function scrollToHomeSectionWhenReady(
  sectionId: string,
  behavior: ScrollBehavior = 'auto',
): void {
  if (scrollToHomeSection(sectionId, behavior)) return

  const deadline = Date.now() + 500
  const tryScroll = () => {
    if (scrollToHomeSection(sectionId, behavior)) return
    if (Date.now() < deadline) window.requestAnimationFrame(tryScroll)
  }
  window.requestAnimationFrame(tryScroll)
}

type HomeSectionSpyOptions = {
  onActiveSectionChange: (sectionId: HomeSectionId | null) => void
  isLocked?: () => boolean
}

/**
 * Track which home section is in view below the navbar using Intersection Observer.
 * Returns a cleanup function.
 */
export function observeHomeSections(options: HomeSectionSpyOptions): () => void {
  const { onActiveSectionChange, isLocked } = options
  const navbarHeight = getNavbarHeightPx()
  const ratios = new Map<string, number>()

  const pickActiveSection = () => {
    if (isLocked?.()) return

    let bestId: HomeSectionId | null = null
    let bestRatio = 0

    for (const section of HOME_SECTIONS) {
      const ratio = ratios.get(section.id) ?? 0
      if (ratio > bestRatio) {
        bestRatio = ratio
        bestId = section.id
      }
    }

    onActiveSectionChange(bestRatio > 0 ? bestId : null)
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
      }
      pickActiveSection()
    },
    {
      root: null,
      // Active zone: strip below navbar through upper half of the viewport.
      rootMargin: `-${navbarHeight}px 0px -50% 0px`,
      threshold: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    },
  )

  const elements = HOME_SECTIONS
    .map((section) => document.getElementById(section.id))
    .filter((el): el is HTMLElement => el !== null)

  if (elements.length === 0) {
    return () => {}
  }

  for (const el of elements) {
    observer.observe(el)
  }

  pickActiveSection()

  return () => observer.disconnect()
}
