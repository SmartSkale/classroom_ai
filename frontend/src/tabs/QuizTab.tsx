import { useState } from 'react'
import { exportQuizXlsx, generateQuiz, type QuizDifficulty, type QuizResponse } from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader, ProgressBar } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

const MAX_TOTAL = 20

const LEVELS: { id: QuizDifficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Recall' },
  { id: 'medium', label: 'Medium', hint: 'Understanding' },
  { id: 'hard', label: 'Hard', hint: 'Application' },
]

function DifficultyChip({ level }: { level: QuizDifficulty | null | undefined }) {
  if (!level) return null
  return <span className={`chip chip-${level}`}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
}

export function QuizTab() {
  const s = useSource()
  const [counts, setCounts] = useState<Record<QuizDifficulty, number>>({ easy: 2, medium: 2, hard: 1 })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<QuizResponse | null>(null)
  const [requestedTotal, setRequestedTotal] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [index, setIndex] = useState(0)
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState(false)

  const total = counts.easy + counts.medium + counts.hard
  const overLimit = total > MAX_TOTAL

  const setCount = (level: QuizDifficulty, raw: string) => {
    const n = Math.max(0, Math.min(MAX_TOTAL, Number(raw) || 0))
    setCounts((prev) => ({ ...prev, [level]: n }))
  }

  const generate = async () => {
    setError(null)
    setQuiz(null)
    setAnswers({})
    setIncluded({})
    setIndex(0)
    setBusy(true)
    setRequestedTotal(total)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Writing questions…')
      const res = await generateQuiz({
        topic: s.topic,
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
        easy_count: counts.easy,
        medium_count: counts.medium,
        hard_count: counts.hard,
      })
      setQuiz(res)
      // Every question starts included; the user deselects what they do not want.
      setIncluded(Object.fromEntries(res.questions.map((q) => [q.id, true])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const selectedQuestions = quiz ? quiz.questions.filter((q) => included[q.id]) : []
  const allSelected = quiz ? quiz.questions.length > 0 && selectedQuestions.length === quiz.questions.length : false

  const setAll = (value: boolean) => {
    if (!quiz) return
    setIncluded(Object.fromEntries(quiz.questions.map((q) => [q.id, value])))
  }

  const downloadExcel = async () => {
    if (!quiz || selectedQuestions.length === 0) return
    setError(null)
    setExporting(true)
    try {
      const blob = await exportQuizXlsx({ ...quiz, questions: selectedQuestions })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quiz.topic.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'classroomai'}_quiz.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  const answered = quiz ? quiz.questions.filter((q) => answers[q.id] !== undefined).length : 0
  const correct = quiz
    ? quiz.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] === q.correct_option_index).length
    : 0
  const q = quiz?.questions[index]
  const picked = q ? answers[q.id] : undefined
  const isAnswered = picked !== undefined
  const isCorrect = isAnswered && picked === q?.correct_option_index
  const pickedExplanation = q && isAnswered && q.option_explanations?.[picked] ? q.option_explanations[picked] : null

  return (
    <>
      <PageHeader
        title="Quiz"
        description="Set how many easy, medium, and hard questions you want. Each one is written from your source, with an explanation for every answer."
      />
      <SourceBar />

      <Card title="Quiz settings">
        <div className="difficulty-grid">
          {LEVELS.map((level) => (
            <Field key={level.id} label={`${level.label} questions`} hint={level.hint}>
              <input
                type="number"
                min={0}
                max={MAX_TOTAL}
                value={counts[level.id]}
                onChange={(e) => setCount(level.id, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <p className="muted">
          Total: <strong>{total}</strong> question{total === 1 ? '' : 's'}
          {overLimit ? ` (the maximum is ${MAX_TOTAL})` : ''}
        </p>
        <div className="row-wrap">
          <Button
            icon="quiz"
            loading={busy}
            disabled={total === 0 || overLimit || !s.hasSource}
            onClick={generate}
          >
            {busy ? status ?? 'Generating…' : quiz ? 'Generate new quiz' : 'Generate quiz'}
          </Button>
          {!s.hasSource && <span className="muted">Add a source above first.</span>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {quiz && quiz.questions.length < requestedTotal && (
          <Notice tone="info">
            The model produced {quiz.questions.length} of the {requestedTotal} questions you asked for. Generate again to fill the rest.
          </Notice>
        )}
      </Card>

      {!quiz && !busy && (
        <Card>
          <EmptyState icon="quiz" title="No quiz yet">
            Choose how many easy, medium, and hard questions you need, then generate.
          </EmptyState>
        </Card>
      )}

      {quiz && q && (
        <Card
          title={`Question ${index + 1} of ${quiz.questions.length}`}
          description={`${answered} of ${quiz.questions.length} answered · ${correct} correct`}
          actions={<DifficultyChip level={q.difficulty} />}
        >
          <ProgressBar value={answered} max={quiz.questions.length} />

          <h3 className="question">{q.question}</h3>
          <div className="choices" role="radiogroup" aria-label="Answer choices">
            {q.options.map((opt, oi) => {
              const selected = picked === oi
              const state = isAnswered ? (oi === q.correct_option_index ? 'correct' : selected ? 'wrong' : '') : ''
              return (
                <button
                  key={oi}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`choice ${selected ? 'selected' : ''} ${state}`.trim()}
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                >
                  <span className="choice-letter">{String.fromCharCode(65 + oi)}</span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>

          {isAnswered && (
            <Notice tone={isCorrect ? 'success' : 'error'}>
              <strong>{isCorrect ? 'Correct.' : 'Not quite.'}</strong>{' '}
              {pickedExplanation || (isCorrect ? q.correct_explanation : q.wrong_explanation)}
              {!isCorrect && (
                <>
                  <br />
                  Correct answer: <strong>{q.options[q.correct_option_index]}</strong>
                </>
              )}
            </Notice>
          )}

          <div className="row-wrap space-between">
            <Button variant="secondary" icon="left" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Previous
            </Button>
            <label className="toggle">
              <input
                type="checkbox"
                checked={!!included[q.id]}
                onChange={(e) => setIncluded((prev) => ({ ...prev, [q.id]: e.target.checked }))}
              />
              <span>Include in Excel export</span>
            </label>
            <Button
              variant="secondary"
              disabled={index >= quiz.questions.length - 1}
              onClick={() => setIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
            >
              Next
            </Button>
          </div>

          {answered === quiz.questions.length && (
            <Notice tone="success">
              <strong>Final score: {correct} of {quiz.questions.length}.</strong>{' '}
              {correct === quiz.questions.length
                ? 'Excellent, every answer is correct.'
                : 'Review the explanations above and try again.'}
            </Notice>
          )}
        </Card>
      )}

      {quiz && quiz.questions.length > 0 && (
        <Card
          title="Export to Excel"
          description={`${selectedQuestions.length} of ${quiz.questions.length} questions selected. Deselect any question you do not need.`}
          actions={
            <Button variant="secondary" icon="download" loading={exporting} disabled={selectedQuestions.length === 0} onClick={downloadExcel}>
              Download Excel ({selectedQuestions.length})
            </Button>
          }
        >
          <div className="row-wrap">
            <Button variant="ghost" onClick={() => setAll(!allSelected)}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
          </div>
          <ul className="export-list">
            {quiz.questions.map((item, i) => (
              <li key={item.id} className={`export-row ${included[item.id] ? '' : 'is-off'}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!included[item.id]}
                    onChange={(e) => setIncluded((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  />
                  <span className="export-num">{i + 1}</span>
                  <span className="export-text">
                    <span className="export-q">{item.question}</span>
                    <span className="muted">Answer: {item.options[item.correct_option_index]}</span>
                  </span>
                  <DifficultyChip level={item.difficulty} />
                </label>
              </li>
            ))}
          </ul>
          {selectedQuestions.length === 0 && <Notice tone="info">Select at least one question to export.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </Card>
      )}
    </>
  )
}
