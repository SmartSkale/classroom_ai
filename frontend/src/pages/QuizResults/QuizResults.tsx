import { useCallback } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { quizService, type QuizResult } from '../../services/quizService'
import {
  flashcardsRoute,
  projectRoute,
  quizTakeRoute,
  ROUTES,
} from '../../utils/constants'
import './QuizResults.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes} min ${seconds} sec`
}

type ResultsLocationState = {
  name?: string
  result?: QuizResult
}

export function QuizResults() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const navState = (location.state ?? null) as ResultsLocationState | null
  const projectName = navState?.name ?? 'Your Project'

  const fetchResult = useCallback(async () => {
    if (navState?.result) return navState.result
    return quizService.getQuizResult(id, user?.id)
  }, [id, navState?.result, user?.id])

  const { data: result, loading, error, refetch } = useFetch<QuizResult | null>(fetchResult, [
    id,
    navState?.result,
    user?.id,
  ])

  if (loading) return <Loader fullscreen label="Loading your results…" />

  if (error || !result) {
    return (
      <div className="results">
        <div className="results-error" role="alert">
          <p>No quiz results yet. Take the quiz first to see your score.</p>
          <Button variant="primary" size="sm" onClick={() => navigate(quizTakeRoute(id))}>
            Take Quiz
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="results">
      <nav className="results-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="results-breadcrumb-current">Quiz Results</span>
      </nav>

      <h1 className="results-title">Quiz Results — {projectName}</h1>

      <section className={`results-score ${result.passed ? 'is-pass' : 'is-fail'}`}>
        <div className="results-score-main">
          <span className="results-score-value">
            {result.score} / {result.total}
          </span>
          <span className="results-score-percent">({result.percent}%)</span>
        </div>
        <span className={`results-badge ${result.passed ? 'badge-pass' : 'badge-fail'}`}>
          {result.passed ? 'PASS' : 'FAIL'}
        </span>
      </section>

      <p className="results-time">
        Time Taken: <strong>{formatDuration(result.timeTakenSeconds)}</strong>
      </p>

      <section className="results-review" aria-label="Question review">
        <h2 className="results-review-title">Question Review</h2>
        <ul className="results-list">
          {result.items.map((item) => (
            <li
              key={item.number}
              className={`results-item ${item.isCorrect ? 'is-correct' : 'is-wrong'}`}
            >
              <p className="results-item-head">
                <span className="results-item-num">Q{item.number}</span>
                <span className={`results-tag ${item.isCorrect ? 'tag-correct' : 'tag-wrong'}`}>
                  {item.isCorrect ? 'Correct' : 'Wrong'}
                </span>
                <span className="results-item-prompt">{item.prompt}</span>
              </p>

              {item.yourAnswerIndex >= 0 && item.options[item.yourAnswerIndex] && (
                <p className="results-answer">
                  Your Answer:{' '}
                  <span className={item.isCorrect ? 'answer-ok' : 'answer-bad'}>
                    ({LETTERS[item.yourAnswerIndex]}) {item.options[item.yourAnswerIndex]}
                  </span>
                  {item.isCorrect && <span className="results-ok-mark"> ✓</span>}
                </p>
              )}

              {!item.isCorrect && (
                <>
                  <p className="results-answer">
                    Correct Answer:{' '}
                    <span className="answer-correct">
                      ({LETTERS[item.correctAnswerIndex]}){' '}
                      {item.options[item.correctAnswerIndex]}
                    </span>
                  </p>
                  {item.explanation && (
                    <p className="results-explanation">
                      <span className="results-explanation-label">Explanation:</span>{' '}
                      {item.explanation}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="results-actions">
        <Button
          variant="primary"
          onClick={() => navigate(quizTakeRoute(id), { state: { name: projectName } })}
        >
          Retry Quiz
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(flashcardsRoute(id), { state: { name: projectName } })}
        >
          Study Flashcards
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(projectRoute(id), { state: { name: projectName } })}
        >
          Back to Lesson
        </Button>
      </div>
    </div>
  )
}

export default QuizResults
