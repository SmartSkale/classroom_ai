import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useGeneration } from '../../context/generation-context'
import { generationService } from '../../services/generationService'
import { ROUTES, slidesRoute, type SlideThemeId } from '../../utils/constants'
import type { SlideInclude, SlidePreviewNavState } from './Slides'
import './Slides.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

const DEFAULT_INCLUDE: SlideInclude = { images: true, bullets: true, speakerNotes: true }

export function SlidesPreview() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { jobs } = useGeneration()
  const job = jobs[id]
  const navState = (location.state ?? null) as SlidePreviewNavState | null

  const deck = job?.results.slides ?? null
  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const theme: SlideThemeId = navState?.theme ?? 'professional_dark'
  const include = navState?.include ?? DEFAULT_INCLUDE

  const [toast, setToast] = useState<Toast | null>(null)
  const [downloading, setDownloading] = useState(false)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  async function handleDownload() {
    if (!deck) return
    setDownloading(true)
    try {
      // The PPTX endpoint requires auth, so fetch it through the API client
      // (which attaches the bearer token) and save the returned blob.
      const blob = await generationService.downloadSlideDeck(deck.deckId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = deck.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast({ type: 'success', message: 'Slide deck downloaded.' })
    } catch {
      showToast({ type: 'error', message: 'Could not download the deck. Please try again.' })
    } finally {
      setDownloading(false)
    }
  }

  if (!deck) {
    return (
      <div className="slides">
        <nav className="slides-breadcrumb" aria-label="Breadcrumb">
          <Link to={ROUTES.dashboard}>{projectName}</Link>
          <span aria-hidden="true">›</span>
          <span className="slides-breadcrumb-current">Slides</span>
        </nav>
        <div className="slides-empty">
          <p>No slide deck to preview yet.</p>
          <Button variant="primary" onClick={() => navigate(slidesRoute(id), { state: navState })}>
            Configure slides
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="slides">
      <nav className="slides-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <Link to={slidesRoute(id)} state={navState}>
          Slides
        </Link>
        <span aria-hidden="true">›</span>
        <span className="slides-breadcrumb-current">Preview</span>
      </nav>

      <header className="slides-preview-header">
        <div>
          <h1 className="slides-title">{deck.deckTitle}</h1>
          <p className="slides-subtitle">
            {deck.slides.length} slide{deck.slides.length === 1 ? '' : 's'} · {deck.filename}
          </p>
        </div>
        <div className="slides-preview-actions">
          <Button variant="primary" size="sm" onClick={handleDownload} disabled={downloading}>
            {downloading ? 'Downloading…' : 'Download PPTX'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(slidesRoute(id), { state: navState })}
          >
            Regenerate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.dashboard)}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className={`slides-deck slides-theme-${theme}`}>
        {deck.slides.map((slide, i) => (
          <article className="slide-card" key={i}>
            <div className="slide-card-index">{i + 1}</div>

            {include.images && (
              <div className="slide-card-media" aria-hidden="true">
                <span className="slide-card-media-icon">🖼️</span>
                <span className="slide-card-media-label">
                  {slide.imageQuery || 'Stock photo'}
                </span>
              </div>
            )}

            <div className="slide-card-body">
              <h2 className="slide-card-title">{slide.title}</h2>

              {include.bullets && slide.bullets.length > 0 && (
                <ul className="slide-card-bullets">
                  {slide.bullets.map((b, bi) => (
                    <li key={bi}>{b}</li>
                  ))}
                </ul>
              )}

              {include.speakerNotes && slide.speakerNotes && (
                <div className="slide-card-notes">
                  <span className="slide-card-notes-label">Speaker notes</span>
                  <p>{slide.speakerNotes}</p>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {toast && (
        <div className={`slides-toast slides-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default SlidesPreview
