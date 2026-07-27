import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectFailures } from '../../components/ProjectFailures/ProjectFailures'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { useProjectJob } from '../../hooks/useProjectJob'
import { generationService } from '../../services/generationService'
import {
  ROUTES,
  SLIDE_COUNT_OPTIONS,
  SLIDE_THEMES,
  slidesPreviewRoute,
  type SlideThemeId,
} from '../../utils/constants'
import './Slides.css'

export interface SlideInclude {
  images: boolean
  bullets: boolean
  speakerNotes: boolean
}

export interface SlidePreviewNavState {
  name?: string
  text?: string
  theme?: SlideThemeId
  include?: SlideInclude
}

const GENERATE_ERROR =
  'Slides generation failed. Try with fewer slides or a different theme.'

export function Slides() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { cacheResults } = useGeneration()
  const { job, loading: jobLoading, loadError } = useProjectJob(id)
  const navState = location.state as { name?: string; text?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text ?? ''
  const outputLanguage = job?.outputLanguage ?? 'english'
  const cachedDeck = job?.results.slides ?? null

  const defaultCount = cachedDeck
    ? (SLIDE_COUNT_OPTIONS.find((n) => n >= cachedDeck.slides.length) ?? 10)
    : 10

  const [count, setCount] = useState<number>(defaultCount)
  const [theme, setTheme] = useState<SlideThemeId>(SLIDE_THEMES[0].id)
  const [include, setInclude] = useState<SlideInclude>({
    images: true,
    bullets: true,
    speakerNotes: false,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleInclude(key: keyof SlideInclude) {
    setInclude((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const deck = await generationService.generateSlides(projectName, sourceText, {
        slideCount: count,
        outputLanguage,
      })
      cacheResults(id, { slides: deck })
      const state: SlidePreviewNavState = {
        name: projectName,
        text: sourceText || undefined,
        theme,
        include,
      }
      navigate(slidesPreviewRoute(id), { state })
    } catch {
      setError(GENERATE_ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="slides">
      <nav className="slides-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="slides-breadcrumb-current">Slides</span>
      </nav>

      <header className="slides-header">
        <h1 className="slides-title">Slide Settings</h1>
        <p className="slides-subtitle">Configure your deck, then generate a PowerPoint file.</p>
      </header>

      {jobLoading && <Loader label="Loading project…" />}

      {!jobLoading && loadError && (
        <div className="slides-error-box" role="alert">
          <p>{loadError}</p>
        </div>
      )}

      {!jobLoading && !loadError && <ProjectFailures job={job} stepKey="slides" />}

      <section className="slides-settings" aria-label="Slide settings">
        <label className="slides-control">
          <span>Number of Slides</span>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={loading}
          >
            {SLIDE_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="slides-hint">Between 5 and 20 slides per deck.</span>
        </label>

        <label className="slides-control">
          <span>Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as SlideThemeId)}
            disabled={loading}
            required
          >
            {SLIDE_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="slides-control slides-include">
          <legend>Include</legend>
          <label className="slides-checkbox">
            <input
              type="checkbox"
              checked={include.images}
              onChange={() => toggleInclude('images')}
              disabled={loading}
            />
            <span>Images</span>
          </label>
          <label className="slides-checkbox">
            <input
              type="checkbox"
              checked={include.bullets}
              onChange={() => toggleInclude('bullets')}
              disabled={loading}
            />
            <span>Bullet Points</span>
          </label>
          <label className="slides-checkbox">
            <input
              type="checkbox"
              checked={include.speakerNotes}
              onChange={() => toggleInclude('speakerNotes')}
              disabled={loading}
            />
            <span>Speaker Notes</span>
          </label>
        </fieldset>

        {error && (
          <div className="slides-error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <Loader label="Generating slides…" />
        ) : (
          <div className="slides-actions">
            <Button variant="primary" size="lg" onClick={handleGenerate}>
              Generate Slides
            </Button>
            {cachedDeck && (
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  navigate(slidesPreviewRoute(id), {
                    state: {
                      name: projectName,
                      text: sourceText || undefined,
                      theme,
                      include,
                    } satisfies SlidePreviewNavState,
                  })
                }
              >
                View existing deck
              </Button>
            )}
          </div>
        )}
      </section>

      <ProjectOutputNav
        projectId={id}
        activeOutput="slides"
        projectName={projectName}
        sourceText={sourceText}
      />
    </div>
  )
}

export default Slides
