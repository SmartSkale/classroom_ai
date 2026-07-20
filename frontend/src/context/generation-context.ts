import { createContext, useContext } from 'react'
import type { OutputLanguageId, OutputTypeId } from '../utils/constants'
import type { Explanation } from '../services/explanationService'
import type { QuizQuestion } from '../services/quizService'
import type {
  AudioResult,
  FlashcardDeck,
  ImageResult,
  SlideDeck,
  VideoResult,
} from '../services/generationService'

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed'

export interface GenerationStep {
  /** "extract" or one of the OutputTypeId values. */
  key: string
  label: string
  status: StepStatus
  error?: string
}

/** All output results that may have been generated for a job. */
export interface GenerationResults {
  explanation?: Explanation
  quiz?: QuizQuestion[]
  slides?: SlideDeck
  flashcards?: FlashcardDeck
  audio?: AudioResult
  infographic?: ImageResult
  illustration?: ImageResult
  video?: VideoResult
}

export interface GenerationJob {
  id: string
  name: string
  outputs: OutputTypeId[]
  /** Language for all generated outputs (english | hindi | bengali | marathi | telugu | tamil | roman_hindi). */
  outputLanguage: OutputLanguageId
  /** Source text used to ground every output (typed text or extracted from a file). */
  sourceText: string
  steps: GenerationStep[]
  results: GenerationResults
  progress: number
  done: boolean
  error: string | null
  createdAt: string
}

export interface StartGenerationInput {
  name: string
  text?: string
  files?: File[]
  outputs: OutputTypeId[]
  outputLanguage: OutputLanguageId
}

export interface GenerationContextValue {
  jobs: Record<string, GenerationJob>
  /** True once projects have been loaded from the API (or migration finished). */
  hydrated: boolean
  /** Kick off real backend generation for every selected output. Returns the job id. */
  startGeneration: (input: StartGenerationInput) => string
  /** Re-run generation for an existing saved project. Returns the job id. */
  regenerateProject: (id: string) => string | null
  getJob: (id: string | undefined) => GenerationJob | undefined
  /** Persist a (re)generated result into a job so other screens read it from cache. */
  cacheResults: (id: string, results: Partial<GenerationResults>) => void
  /** Import a shared project snapshot (e.g. from a teacher link). */
  importSharedJob: (job: GenerationJob) => void
  /** Delete a project from the database and in-memory cache. */
  deleteProject: (id: string) => Promise<void>
}

export const GenerationContext = createContext<GenerationContextValue | null>(null)

export function useGeneration(): GenerationContextValue {
  const ctx = useContext(GenerationContext)
  if (!ctx) {
    throw new Error('useGeneration must be used within a GenerationProvider')
  }
  return ctx
}
