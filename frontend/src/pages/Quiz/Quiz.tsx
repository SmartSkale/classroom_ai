import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { quizService, type QuizQuestion, type QuizSettings } from '../../services/quizService'
import { useGeneration } from '../../context/generation-context'
import { publishSharedProject } from '../../utils/sharedProjects'
import { isStudent } from '../../utils/roles'
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  QUIZ_COUNT_OPTIONS,
  ROUTES,
  quizResultsRoute,
  quizTakeRoute,
  type Difficulty,
  type QuestionTypeId,
} from '../../utils/constants'
import './Quiz.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function Quiz() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { jobs } = useGeneration()
  const { user } = useAuth()
  const job = jobs[id]
  const studentView = isStudent(user)
  const navState = location.state as { name?: string; text?: string } | null
  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text

  // The quiz was generated up front (during upload); show it from the cache.
  const cachedQuiz = job?.results.quiz ?? null

  const [count, setCount] = useState(10)
  const [types, setTypes] = useState<QuestionTypeId[]>(['mcq'])
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(cachedQuiz)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const generate = useCallback(
    async (settings: QuizSettings, force = false) => {
      setLoading(true)
      setError(null)
      try {
        const result = await quizService.generateQuiz(
          { topic: projectName, contextText: sourceText, settings },
          { force },
        )
        setQuestions(result)
      } catch {
        setError('Quiz generation failed. Check your content and try again.')
      } finally {
        setLoading(false)
      }
    },
    [projectName, sourceText],
  )

  // No generation on navigating into this page — the quiz is produced up front
  // during upload. We only clean up the toast timer here.
  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  function toggleType(typeId: QuestionTypeId) {
    setTypeError(null)
    setTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId],
    )
  }

  function handleRegenerate() {
    if (types.length === 0) {
      setTypeError('Select at least one question type.')
      return
    }
    void generate({ count, types, difficulty }, true)
  }

  function handleDownload() {
    if (!questions || questions.length === 0) return
    const lines: string[] = [`${projectName} — Quiz`, '']
    questions.forEach((q) => {
      lines.push(`Q${q.number}. ${q.prompt}`)
      if (q.options) {
        q.options.forEach((opt, i) => lines.push(`   (${LETTERS[i]}) ${opt}`))
      }
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName.replace(/\s+/g, '-').toLowerCase()}-quiz.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', message: 'Quiz downloaded.' })
  }

  async function handleShare() {
    if (job) publishSharedProject(job)
    const link = `${window.location.origin}/q/${id}`
    try {
      await navigator.clipboard.writeText(link)
      showToast({ type: 'success', message: 'Quiz link copied to clipboard.' })
    } catch {
      showToast({ type: 'error', message: 'Could not copy link. Please try again.' })
    }
  }

  return (
    <div className="quiz">
      <nav className="quiz-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="quiz-breadcrumb-current">Quiz</span>
      </nav>

      <div className={`quiz-grid${studentView ? ' quiz-grid-student' : ''}`}>
        {!studentView && (
        <section className="quiz-settings" aria-label="Quiz settings">
          <h2 className="quiz-settings-title">Quiz Settings</h2>

          <label className="quiz-control">
            <span>Number of Questions</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {QUIZ_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="quiz-hint">Up to 15 per generation.</span>
          </label>

          <fieldset className="quiz-control quiz-types">
            <legend>Question Types</legend>
            {QUESTION_TYPES.map((t) => (
              <label key={t.id} className="quiz-checkbox">
                <input
                  type="checkbox"
                  checked={types.includes(t.id)}
                  onChange={() => toggleType(t.id)}
                />
                <span>{t.label}</span>
              </label>
            ))}
            {typeError && <p className="quiz-error">{typeError}</p>}
            <span className="quiz-hint">The model generates multiple-choice questions.</span>
          </fieldset>

          <label className="quiz-control">
            <span>Difficulty</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            fullWidth
            onClick={handleRegenerate}
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Regenerate'}
          </Button>
        </section>
        )}

        <section className={`quiz-preview${studentView ? ' quiz-preview-full' : ''}`} aria-label="Quiz preview">
          <h2 className="quiz-preview-title">Preview</h2>

          {loading && <Loader label="Generating quiz…" />}

          {!loading && error && (
            <div className="quiz-error-box" role="alert">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && !questions && (
            <div className="quiz-error-box">
              <p>No quiz available yet. Adjust the settings and generate one.</p>
              <Button variant="primary" size="sm" onClick={handleRegenerate}>
                Generate Quiz
              </Button>
            </div>
          )}

          {!loading && !error && questions && (
            <ol className="quiz-questions">
              {questions.map((q) => (
                <li key={q.id} className="quiz-question">
                  <p className="quiz-question-prompt">
                    <span className="quiz-question-num">Q{q.number}.</span> {q.prompt}
                  </p>
                  {q.options && (
                    <ul className="quiz-options">
                      {q.options.map((opt, i) => (
                        <li key={i}>
                          <span className="quiz-option-letter">({LETTERS[i]})</span> {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.type === 'fill' && <p className="quiz-fill-hint">Fill in the blank.</p>}
                </li>
              ))}
            </ol>
          )}

          {!loading && !error && questions && questions.length > 0 && (
            <div className="quiz-actions">
              {!studentView && (
                <>
                  <Button variant="primary" onClick={handleDownload}>
                    Download
                  </Button>
                  <Button variant="outline" onClick={handleShare}>
                    Share with Students
                  </Button>
                  <Button variant="ghost" onClick={handleRegenerate}>
                    Regenerate
                  </Button>
                </>
              )}
              <Button
                variant="primary"
                onClick={() =>
                  navigate(quizTakeRoute(id), { state: { name: projectName } })
                }
              >
                Take Quiz
              </Button>
              {studentView && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(quizResultsRoute(id), { state: { name: projectName } })
                  }
                >
                  View Results
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className={`quiz-toast quiz-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Quiz
