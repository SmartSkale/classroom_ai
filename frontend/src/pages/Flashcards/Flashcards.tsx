import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectFailures } from '../../components/ProjectFailures/ProjectFailures'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { useProjectJob } from '../../hooks/useProjectJob'
import { useProjectOutputState } from '../../hooks/useProjectOutputState'
import { downloadFlashcardsPdf } from '../../utils/flashcardPdf'
import { useAuth } from '../../hooks/useAuth'
import { ROUTES } from '../../utils/constants'
import { isStudent } from '../../utils/roles'
import { getStepFailure } from '../../utils/projectStatus'
import './Flashcards.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

function sequential(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

function shuffled(n: number): number[] {
  const arr = sequential(n)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'flashcards'
}

export function Flashcards() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const studentView = isStudent(user)
  const { regenerateOutput } = useGeneration()
  const { job, loading: jobLoading, loadError } = useProjectJob(id)
  const navState = location.state as { name?: string; text?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text ?? ''
  const deck = job?.results.flashcards ?? null
  const cards = useMemo(() => deck?.cards ?? [], [deck])

  const [order, setOrder] = useState<number[]>(() => sequential(cards.length))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [shuffledOn, setShuffledOn] = useState(false)

  const { isGenerating, generatingLabel } = useProjectOutputState(
    job,
    'flashcards',
    false,
    'Generating flashcards…',
  )
  const [genError, setGenError] = useState<string | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    setOrder(sequential(cards.length))
    setIndex(0)
    setFlipped(false)
    setShuffledOn(false)
  }, [cards.length])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const total = cards.length
  const current = total > 0 ? cards[order[index]] : null

  const goPrev = useCallback(() => {
    setFlipped(false)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    setFlipped(false)
    setIndex((i) => Math.min(total - 1, i + 1))
  }, [total])

  useEffect(() => {
    if (total === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, total])

  function handleShuffle() {
    setOrder(shuffled(total))
    setIndex(0)
    setFlipped(false)
    setShuffledOn(true)
    showToast({ type: 'success', message: 'Deck shuffled.' })
  }

  function handleReset() {
    setOrder(sequential(total))
    setIndex(0)
    setFlipped(false)
    setShuffledOn(false)
  }

  async function handleDownloadPdf() {
    if (total === 0) return
    try {
      await downloadFlashcardsPdf(
        projectName,
        cards,
        order,
        `${slugify(projectName)}-flashcards.pdf`,
        job?.outputLanguage,
      )
      showToast({ type: 'success', message: 'Flashcard PDF downloaded.' })
    } catch {
      showToast({ type: 'error', message: 'Could not generate flashcard PDF. Try again.' })
    }
  }

  async function handleGenerate() {
    if (!id) return
    setGenError(null)
    const ok = await regenerateOutput(id, 'flashcards', {
      sourceText,
      topicHint: projectName,
    })
    if (!ok) {
      setGenError('Could not start flashcard generation. Open the project once, then try again.')
    }
  }

  return (
    <div className="flashcards">
      <nav className="flashcards-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="flashcards-breadcrumb-current">Flashcards</span>
        {total > 0 && !isGenerating && (
          <span className="flashcards-counter-inline">
            Card {index + 1} of {total}
          </span>
        )}
      </nav>

      {jobLoading && <Loader label="Loading project…" />}

      {!jobLoading && loadError && (
        <p className="flashcards-error" role="alert">
          {loadError}
        </p>
      )}

      {!jobLoading && !loadError && <ProjectFailures job={job} stepKey="flashcards" />}

      {total === 0 ? (
        <div className="flashcards-empty">
          {isGenerating ? (
            <Loader label={generatingLabel} fullscreen />
          ) : (
            <>
              {!getStepFailure(job, 'flashcards') && (
                <p>
                  {studentView
                    ? 'Flashcards are not available for this lesson yet.'
                    : 'No flashcards yet for this project.'}
                </p>
              )}
              {genError && <p className="flashcards-error">{genError}</p>}
              {!studentView && !getStepFailure(job, 'flashcards') && (
                <Button variant="outline" onClick={() => void handleGenerate()}>
                  Generate Flashcards
                </Button>
              )}
            </>
          )}
        </div>
      ) : isGenerating ? (
        <div className="flashcards-empty">
          <Loader label={generatingLabel} fullscreen />
        </div>
      ) : (
        <>
          <div className="flashcards-stage">
            <button
              type="button"
              className={`flashcard ${flipped ? 'flashcard-flipped' : ''}`}
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show question' : 'Show answer'}
            >
              <div className="flashcard-inner">
                <div className="flashcard-face flashcard-front">
                  <span className="flashcard-side-label">Question</span>
                  <p className="flashcard-text">{current?.front}</p>
                  <span className="flashcard-hint">Tap to flip</span>
                </div>
                <div className="flashcard-face flashcard-back">
                  <span className="flashcard-side-label">Answer</span>
                  <p className="flashcard-text">{current?.back}</p>
                  <span className="flashcard-hint">Tap to flip</span>
                </div>
              </div>
            </button>
          </div>

          <div className="flashcards-nav">
            <Button variant="outline" onClick={goPrev} disabled={index === 0}>
              ‹ Prev
            </Button>
            <span className="flashcards-counter">
              {index + 1} / {total}
            </span>
            <Button variant="outline" onClick={goNext} disabled={index === total - 1}>
              Next ›
            </Button>
          </div>

          <div className="flashcards-actions">
            <Button variant="outline" onClick={handleShuffle}>
              🔀 Shuffle
            </Button>
            {!studentView && (
              <>
                <Button variant="outline" onClick={handleDownloadPdf}>
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => void handleGenerate()} disabled={isGenerating}>
                  {isGenerating ? 'Generating…' : 'Regenerate'}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleReset} disabled={index === 0 && !shuffledOn}>
              Reset
            </Button>
          </div>
        </>
      )}

      <ProjectOutputNav
        projectId={id}
        activeOutput="flashcards"
        projectName={projectName}
        sourceText={sourceText}
        studentView={studentView}
        outlineOnly
      />

      {toast && (
        <div className={`flashcards-toast flashcards-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Flashcards
