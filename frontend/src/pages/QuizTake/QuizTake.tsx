import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useGeneration } from '../../context/generation-context'
import { quizService, sanitizeQuizQuestions } from '../../services/quizService'
import { quizResultsRoute, ROUTES } from '../../utils/constants'
import { updateQuizProgress } from '../../utils/studentAssignments'
import './QuizTake.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function QuizTake() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { jobs } = useGeneration()
  const job = jobs[id]
  const navState = location.state as { name?: string } | null
  const projectName = job?.name ?? navState?.name ?? 'Your Project'

  const questions = useMemo(
    () => sanitizeQuizQuestions(job?.results.quiz ?? []),
    [job],
  )
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [startedAt] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (questions.length > 0) return
    const t = setTimeout(() => setError('No quiz is available for this lesson.'), 300)
    return () => clearTimeout(t)
  }, [questions.length])

  const answeredCount = Object.keys(answers).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  async function handleSubmit() {
    if (!allAnswered || !questions.length) return
    setSubmitting(true)
    setError(null)
    try {
      const timeTakenSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      const result = await quizService.submitQuizAttempt(
        id,
        answers,
        timeTakenSeconds,
        questions,
        user?.id,
      )
      updateQuizProgress(id, result.percent, result.passed)
      navigate(quizResultsRoute(id), {
        replace: true,
        state: { name: projectName, result },
      })
    } catch {
      setError('Could not submit your quiz. Please try again.')
      setSubmitting(false)
    }
  }

  if (!job && questions.length === 0) {
    return (
      <div className="quiz-take">
        <Loader fullscreen label="Loading quiz…" />
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="quiz-take">
        <div className="quiz-take-error" role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => navigate(ROUTES.dashboard)}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="quiz-take">
      <nav className="quiz-take-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span>Take Quiz</span>
      </nav>

      <header className="quiz-take-header">
        <h1>{projectName} — Quiz</h1>
        <p className="quiz-take-progress">
          Answered {answeredCount} of {questions.length}
        </p>
      </header>

      <ol className="quiz-take-questions">
        {questions.map((q) => (
          <li key={q.id} className="quiz-take-question">
            <p className="quiz-take-prompt">
              <span className="quiz-take-num">Q{q.number}.</span> {q.prompt}
            </p>
            <ul className="quiz-take-options" role="radiogroup" aria-label={`Question ${q.number}`}>
              {(q.options ?? []).map((opt, i) => {
                const selected = answers[q.id] === i
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`quiz-take-option${selected ? ' is-selected' : ''}`}
                      onClick={() => selectAnswer(q.id, i)}
                      aria-pressed={selected}
                    >
                      <span className="quiz-take-letter">({LETTERS[i]})</span> {opt}
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      {error && (
        <p className="quiz-take-submit-error" role="alert">
          {error}
        </p>
      )}

      <div className="quiz-take-actions">
        <Button variant="outline" disabled={!allAnswered || submitting} onClick={() => void handleSubmit()}>
          {submitting ? 'Submitting…' : 'Submit Quiz'}
        </Button>
        {!allAnswered && (
          <p className="quiz-take-hint">Answer every question before submitting.</p>
        )}
      </div>
    </div>
  )
}

export default QuizTake
