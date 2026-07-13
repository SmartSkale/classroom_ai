import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Button } from '../../components/Button'
import { DownloadAllButton } from '../../components/DownloadAllButton'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import {
  explanationService,
  type Explanation as ExplanationData,
} from '../../services/explanationService'
import { useGeneration } from '../../context/generation-context'
import {
  ROUTES,
  quizRoute,
  quizTakeRoute,
  slidesRoute,
  flashcardsRoute,
  audioRoute,
  infographicRoute,
  videoRoute,
} from '../../utils/constants'
import { isStudent } from '../../utils/roles'
import './Explanation.css'

const MermaidDiagram = lazy(() =>
  import('../../components/MermaidDiagram').then((m) => ({ default: m.MermaidDiagram })),
)

interface Toast {
  type: 'success' | 'error'
  message: string
}

export function Explanation() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { jobs } = useGeneration()
  const { user } = useAuth()
  const job = jobs[id]
  const studentView = isStudent(user)
  const navState = location.state as { name?: string; text?: string } | null
  const projectName = job?.name ?? navState?.name ?? 'Your Project'

  // Content was already generated during upload; show it from the job cache.
  const cachedExplanation = job?.results.explanation ?? null
  const sourceText = job?.sourceText ?? navState?.text ?? ''

  const [chapterText, setChapterText] = useState(sourceText)
  const [topicHint, setTopicHint] = useState(job?.name ?? navState?.name ?? '')
  const [content, setContent] = useState<ExplanationData | null>(cachedExplanation)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputOpen, setInputOpen] = useState(!cachedExplanation)

  const explanation = content ?? job?.results.explanation ?? null

  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const generate = useCallback(async (text: string, topic: string) => {
    if (!text.trim()) {
      setError('Paste some chapter text to generate an explanation.')
      setInputOpen(true)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await explanationService.generateExplanation({
        chapterText: text,
        topicHint: topic,
      })
      setContent(result)
      setInputOpen(false)
    } catch {
      setError('Explanation generation failed. Check your content and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // The explanation is generated up front (during upload), so we only display
  // the cached result here — no generation happens on navigating into this page.
  useEffect(() => {
    if (job?.results.explanation) {
      setContent(job.results.explanation)
      setInputOpen(false)
    }
    if (job?.sourceText) {
      setChapterText(job.sourceText)
    }
    if (job?.name) {
      setTopicHint(job.name)
    }
  }, [job])

  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  async function handleCopy() {
    if (!explanation) return
    try {
      await navigator.clipboard.writeText(explanation.markdown)
      showToast({ type: 'success', message: 'Explanation copied to clipboard.' })
    } catch {
      showToast({ type: 'error', message: 'Could not copy. Please try again.' })
    }
  }

  function handleDownload() {
    if (!explanation) return
    const blob = new Blob([explanation.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-explanation.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', message: 'Explanation downloaded.' })
  }

  return (
    <div className="explanation">
      <nav className="explanation-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="explanation-breadcrumb-current">Explanation</span>
      </nav>

      <header className="explanation-header">
        <div>
          <h1 className="explanation-title">{projectName}</h1>
          <p className="explanation-subtitle">
            {studentView ? 'Read the lesson, then take the quiz below.' : 'AI-generated explanation'}
          </p>
        </div>
        <div className="explanation-actions">
          {!studentView && (
            <>
              <DownloadAllButton
                job={job}
                variant="outline"
                size="sm"
                compact
                onComplete={(r) =>
                  showToast({
                    type: 'success',
                    message: `Downloaded ${r.included.length} files as ZIP.`,
                  })
                }
                onError={(msg) => showToast({ type: 'error', message: msg })}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputOpen((v) => !v)}
              >
                {inputOpen ? 'Hide edit' : 'Edit'}
              </Button>
            </>
          )}
        </div>
      </header>

      {inputOpen && (
        <section className="explanation-input">
          <label className="explanation-field">
            <span>Topic (optional)</span>
            <input
              type="text"
              value={topicHint}
              onChange={(e) => setTopicHint(e.target.value)}
              placeholder="e.g. Human Anatomy — Circulatory System"
            />
          </label>
          <label className="explanation-field">
            <span>Chapter text</span>
            <textarea
              value={chapterText}
              onChange={(e) => setChapterText(e.target.value)}
              placeholder="Paste the chapter or notes you want explained…"
            />
          </label>
          <Button
            variant="primary"
            onClick={() => generate(chapterText, topicHint)}
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Generate Explanation'}
          </Button>
        </section>
      )}

      {loading && <Loader label="Generating explanation…" />}

      {!loading && error && (
        <div className="explanation-error" role="alert">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => generate(chapterText, topicHint)}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && explanation && (
        <>
          <article className="explanation-body md">
            <ReactMarkdown>{explanation.markdown}</ReactMarkdown>
          </article>

          {explanation.mermaid && (
            <section className="explanation-diagram">
              <h2 className="explanation-section-title">Diagram</h2>
              <Suspense fallback={<Loader label="Rendering diagram…" />}>
                <MermaidDiagram code={explanation.mermaid} />
              </Suspense>
              {explanation.diagramCaption && (
                <p className="explanation-caption">{explanation.diagramCaption}</p>
              )}
            </section>
          )}

          {explanation.examples.length > 0 && (
            <section className="explanation-extra">
              <h2 className="explanation-section-title">Simple Examples</h2>
              <ul>
                {explanation.examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </section>
          )}

          {explanation.followups.length > 0 && (
            <section className="explanation-extra">
              <h2 className="explanation-section-title">Suggested Follow-up Topics</h2>
              <ul>
                {explanation.followups.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="explanation-body-actions" aria-label="Explanation actions">
            {!studentView && (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
                  Copy explanation
                </Button>
                <Button variant="primary" size="sm" onClick={handleDownload}>
                  Download .md
                </Button>
              </>
            )}
            {studentView && (!job || job.outputs.includes('quiz')) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(quizTakeRoute(id), { state: { name: projectName } })
                }
              >
                Take Quiz →
              </Button>
            )}
          </div>

          <footer className="explanation-footer">
            <div className="explanation-footer-actions">
              {studentView && (!job || job.outputs.includes('quiz')) && (
                <Button
                  variant="primary"
                  onClick={() =>
                    navigate(quizTakeRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  Take Quiz →
                </Button>
              )}
              {(!job || job.outputs.includes('quiz')) && !studentView && (
                <Button
                  variant="primary"
                  onClick={() =>
                    navigate(quizRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Quiz →
                </Button>
              )}
              {(!job || job.outputs.includes('slides')) && !studentView && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(slidesRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Slides →
                </Button>
              )}
              {(!job || job.outputs.includes('flashcards')) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(flashcardsRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Flashcards →
                </Button>
              )}
              {(!job || job.outputs.includes('audio')) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(audioRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Audio →
                </Button>
              )}
              {(!job || job.outputs.includes('video')) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(videoRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Video →
                </Button>
              )}
              {(!job || job.outputs.includes('infographic')) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(infographicRoute(id), {
                      state: { name: projectName, text: chapterText || undefined },
                    })
                  }
                >
                  View Infographic →
                </Button>
              )}
              <Button
                variant={studentView ? 'ghost' : 'outline'}
                onClick={() => navigate(studentView ? ROUTES.dashboard : ROUTES.library)}
              >
                {studentView ? 'Back to Dashboard' : 'Project Library'}
              </Button>
            </div>
          </footer>
        </>
      )}

      {toast && (
        <div className={`explanation-toast explanation-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Explanation
