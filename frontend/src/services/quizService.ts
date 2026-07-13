import api from './api'
import {
  QUIZ_COUNT_MAX,
  QUIZ_COUNT_MIN,
  QUIZ_PASS_THRESHOLD,
  type Difficulty,
  type QuestionTypeId,
} from '../utils/constants'

export interface QuizQuestion {
  id: string
  number: number
  type: QuestionTypeId
  prompt: string
  options?: string[]
  answerIndex?: number
  answer?: string
  correctExplanation?: string
  wrongExplanation?: string
}

export interface QuizSettings {
  count: number
  types: QuestionTypeId[]
  difficulty: Difficulty
}

export interface GenerateQuizParams {
  topic: string
  contextText?: string
  settings: QuizSettings
  stack?: string
}

const DIFFICULTY_MAP: Record<Difficulty, 'remedial' | 'standard' | 'advanced'> = {
  easy: 'remedial',
  medium: 'standard',
  hard: 'advanced',
}

interface BackendQuizQuestion {
  id: string
  question: string
  options: string[]
  correct_option_index: number
  correct_explanation?: string
  wrong_explanation?: string
  option_explanations?: string[] | null
}

interface BackendQuizResponse {
  topic: string
  output_language_used: string
  questions: BackendQuizQuestion[]
}

interface ApiQuizResultItem {
  number: number
  prompt: string
  options: string[]
  your_answer_index?: number
  yourAnswerIndex?: number
  correct_answer_index?: number
  correctAnswerIndex?: number
  is_correct?: boolean
  isCorrect?: boolean
  explanation?: string | null
}

interface ApiQuizResult {
  id?: number
  project_id?: string
  score: number
  total: number
  percent: number
  passed: boolean
  time_taken_seconds?: number
  timeTakenSeconds?: number
  submitted_at?: string
  items: ApiQuizResultItem[]
}

function clampCount(n: number): number {
  return Math.min(QUIZ_COUNT_MAX, Math.max(QUIZ_COUNT_MIN, Math.round(n)))
}

async function requestQuiz(params: GenerateQuizParams): Promise<QuizQuestion[]> {
  const { topic, contextText, settings, stack = 'openai' } = params

  const payload = {
    topic: (topic || 'Untitled lesson').slice(0, 200),
    context_text: contextText?.trim() ? contextText.trim().slice(0, 30000) : null,
    output_language: 'english',
    stack,
    question_count: clampCount(settings.count),
    difficulty: DIFFICULTY_MAP[settings.difficulty],
  }

  const { data } = await api.post<BackendQuizResponse>('/quiz/generate', payload)

  return data.questions.map((q, i) => ({
    id: q.id || `q${i + 1}`,
    number: i + 1,
    type: 'mcq' as QuestionTypeId,
    prompt: q.question,
    options: q.options,
    answerIndex: q.correct_option_index,
    correctExplanation: q.correct_explanation,
    wrongExplanation: q.wrong_explanation,
  }))
}

const quizCache = new Map<string, Promise<QuizQuestion[]>>()

function cacheKey(params: GenerateQuizParams): string {
  return JSON.stringify({
    topic: params.topic,
    count: clampCount(params.settings.count),
    types: [...params.settings.types].sort(),
    difficulty: params.settings.difficulty,
    context: params.contextText?.trim() ?? '',
    stack: params.stack ?? 'openai',
  })
}

async function generateQuiz(
  params: GenerateQuizParams,
  opts: { force?: boolean } = {},
): Promise<QuizQuestion[]> {
  const key = cacheKey(params)
  if (!opts.force) {
    const cached = quizCache.get(key)
    if (cached) return cached
  }

  const pending = requestQuiz(params)
  quizCache.set(key, pending)
  try {
    return await pending
  } catch (err) {
    quizCache.delete(key)
    throw err
  }
}

export interface QuizResultItem {
  number: number
  prompt: string
  options: string[]
  yourAnswerIndex: number
  correctAnswerIndex: number
  isCorrect: boolean
  explanation?: string
}

export interface QuizResult {
  score: number
  total: number
  percent: number
  passed: boolean
  timeTakenSeconds: number
  items: QuizResultItem[]
  submittedAt?: string
}

function mapApiResult(data: ApiQuizResult): QuizResult {
  return {
    score: data.score,
    total: data.total,
    percent: data.percent,
    passed: data.passed,
    timeTakenSeconds: data.time_taken_seconds ?? data.timeTakenSeconds ?? 0,
    submittedAt: data.submitted_at,
    items: data.items.map((item) => ({
      number: item.number,
      prompt: item.prompt,
      options: item.options,
      yourAnswerIndex: item.your_answer_index ?? item.yourAnswerIndex ?? -1,
      correctAnswerIndex: item.correct_answer_index ?? item.correctAnswerIndex ?? 0,
      isCorrect: item.is_correct ?? item.isCorrect ?? false,
      explanation: item.explanation ?? undefined,
    })),
  }
}

function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, number>,
  timeTakenSeconds: number,
): QuizResult {
  const items: QuizResultItem[] = questions.map((q) => {
    const yourAnswerIndex = answers[q.id] ?? -1
    const correctAnswerIndex = q.answerIndex ?? 0
    const isCorrect = yourAnswerIndex === correctAnswerIndex
    return {
      number: q.number,
      prompt: q.prompt,
      options: q.options ?? [],
      yourAnswerIndex,
      correctAnswerIndex,
      isCorrect,
      explanation: isCorrect ? q.correctExplanation : q.wrongExplanation ?? q.correctExplanation,
    }
  })

  const score = items.filter((i) => i.isCorrect).length
  const total = items.length
  const percent = total ? Math.round((score / total) * 100) : 0

  return {
    score,
    total,
    percent,
    passed: total > 0 && score / total >= QUIZ_PASS_THRESHOLD,
    timeTakenSeconds,
    items,
  }
}

const RESULTS_PREFIX = 'classroomai.quiz.results.'

function resultsKey(projectId: string, userId?: number): string {
  return `${RESULTS_PREFIX}${userId ?? 'anon'}.${projectId}`
}

function saveResultLocal(projectId: string, result: QuizResult, userId?: number): void {
  localStorage.setItem(resultsKey(projectId, userId), JSON.stringify(result))
}

function getResultLocal(projectId: string, userId?: number): QuizResult | null {
  try {
    const raw = localStorage.getItem(resultsKey(projectId, userId))
    if (!raw) return null
    return JSON.parse(raw) as QuizResult
  } catch {
    return null
  }
}

async function submitQuizAttempt(
  projectId: string,
  answers: Record<string, number>,
  timeTakenSeconds: number,
  questions: QuizQuestion[],
  userId?: number,
): Promise<QuizResult> {
  const payload = {
    project_id: projectId,
    answers,
    time_taken_seconds: timeTakenSeconds,
    questions: questions.map((q) => ({
      id: q.id,
      number: q.number,
      prompt: q.prompt,
      options: q.options ?? [],
      answerIndex: q.answerIndex ?? 0,
      correctExplanation: q.correctExplanation,
      wrongExplanation: q.wrongExplanation,
    })),
  }

  const { data } = await api.post<ApiQuizResult>('/quiz-attempts/submit', payload)
  const result = mapApiResult(data)
  saveResultLocal(projectId, result, userId)
  return result
}

async function getQuizResult(projectId: string, userId?: number): Promise<QuizResult | null> {
  try {
    const { data } = await api.get<ApiQuizResult>(`/quiz-attempts/${projectId}`)
    const result = mapApiResult(data)
    saveResultLocal(projectId, result, userId)
    return result
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status
    if (status === 404) {
      return getResultLocal(projectId, userId)
    }
    throw err
  }
}

/** @deprecated Use submitQuizAttempt — kept for compatibility */
async function saveResult(projectId: string, result: QuizResult, userId?: number): Promise<void> {
  saveResultLocal(projectId, result, userId)
}

export interface GroupQuizResultRow {
  student_id: number | null
  student_email: string
  student_name: string | null
  percent: number | null
  passed: boolean | null
  submitted_at: string | null
}

async function getGroupQuizResults(
  groupId: number,
  projectId: string,
): Promise<GroupQuizResultRow[]> {
  const { data } = await api.get<GroupQuizResultRow[]>(
    `/quiz-attempts/groups/${groupId}/projects/${projectId}`,
  )
  return data
}

export const quizService = {
  generateQuiz,
  scoreQuiz,
  submitQuizAttempt,
  getQuizResult,
  saveResult,
  getGroupQuizResults,
}
export default quizService
