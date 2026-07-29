import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectFailures } from '../../components/ProjectFailures/ProjectFailures'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useAuth } from '../../hooks/useAuth'
import { useProjectJob } from '../../hooks/useProjectJob'
import { useProjectOutputState } from '../../hooks/useProjectOutputState'
import { sanitizeQuizQuestions, type QuizQuestion } from '../../services/quizService'
import { useGeneration } from '../../context/generation-context'
import { isStudent } from '../../utils/roles'
import { getStepFailure } from '../../utils/projectStatus'
import {
  DIFFICULTIES,
  QUIZ_COUNT_OPTIONS,
  ROUTES,
  quizResultsRoute,
  quizTakeRoute,
  type Difficulty,
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
  const { regenerateOutput } = useGeneration()
  const { user } = useAuth()
  const { job, loading: jobLoading, loadError } = useProjectJob(id)
  const studentView = isStudent(user)
  const navState = location.state as { name?: string; text?: string } | null
  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text

  // The quiz was generated up front (during upload); show it from the cache.
  const cachedQuiz = job?.results.quiz ?? null

  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(
    cachedQuiz ? sanitizeQuizQuestions(cachedQuiz) : null,
  )
  const { isGenerating, generatingLabel } = useProjectOutputState(
    job,
    'quiz',
    false,
    'Generating quiz…',
  )
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const startQuizGeneration = useCallback(async () => {
    if (!id) return
    setError(null)
    setQuestions(null)
    const ok = await regenerateOutput(id, 'quiz', {
      sourceText: sourceText ?? undefined,
      topicHint: projectName,
      quizSettings: { count, types: ['mcq'], difficulty },
    })
    if (!ok) {
      setError('Could not start quiz generation. Open the project once, then try again.')
    }
  }, [id, regenerateOutput, sourceText, projectName, count, difficulty])

  // Sync when the project pipeline finishes regenerating this output.
  useEffect(() => {
    if (job?.results.quiz) {
      setQuestions(sanitizeQuizQuestions(job.results.quiz))
    }
  }, [job?.results.quiz])

  // No generation on navigating into this page — the quiz is produced up front
  // during upload. We only clean up the toast timer here.
  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current)
  }, [])

  function handleRegenerate() {
    void startQuizGeneration()
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
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Regenerate'}
          </Button>
        </section>
        )}

        <section className={`quiz-preview${studentView ? ' quiz-preview-full' : ''}`} aria-label="Quiz preview">
          <h2 className="quiz-preview-title">Preview</h2>

          {jobLoading && <Loader label="Loading project…" />}

          {!jobLoading && loadError && (
            <div className="quiz-error-box" role="alert">
              <p>{loadError}</p>
            </div>
          )}

          {!jobLoading && !loadError && <ProjectFailures job={job} stepKey="quiz" />}

          {isGenerating && <Loader label={generatingLabel} fullscreen />}

          {!isGenerating && error && (
            <div className="quiz-error-box" role="alert">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                Try again
              </Button>
            </div>
          )}

          {!isGenerating && !error && !questions && !getStepFailure(job, 'quiz') && (
            <div className="quiz-error-box">
              <p>No quiz available yet. Adjust the settings and generate one.</p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                Generate Quiz
              </Button>
            </div>
          )}

          {!isGenerating && !error && questions && (
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
                </li>
              ))}
            </ol>
          )}

          {!isGenerating && !error && questions && questions.length > 0 && (
            <div className="quiz-actions">
              {!studentView && (
                <>
                  <Button variant="outline" onClick={handleDownload}>
                    Download
                  </Button>
                  <Button variant="outline" onClick={handleRegenerate} disabled={isGenerating}>
                    {isGenerating ? 'Generating…' : 'Regenerate'}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
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

      <ProjectOutputNav
        projectId={id}
        activeOutput="quiz"
        projectName={projectName}
        sourceText={sourceText}
        studentView={studentView}
        outlineOnly
      />

      {toast && (
        <div className={`quiz-toast quiz-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Quiz
