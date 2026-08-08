import type { GenerationJob, GenerationStep } from '../context/generation-context'
import type { OutputTypeId } from './constants'

export type ProjectRunStatus = 'in_progress' | 'complete' | 'partial' | 'failed'

export const CANCELLED_STEP_ERROR = 'Cancelled by user.'

export type ProjectStatusVariant = 'active' | 'warning' | 'error' | 'muted'

export interface ProjectStatusDisplay {
  label: string
  variant: ProjectStatusVariant
  title?: string
}

function formatApiDetail(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return null
      })
      .filter((msg): msg is string => Boolean(msg))
    if (messages.length > 0) return messages.join(' ')
  }
  if (detail && typeof detail === 'object' && 'msg' in detail) {
    return String((detail as { msg: unknown }).msg)
  }
  return null
}

/** Normalize step error values (string, FastAPI validation arrays, etc.) for display. */
export function formatStepError(error: unknown): string {
  if (error === undefined || error === null) return 'Generation failed.'
  if (typeof error === 'string') return error
  const formatted = formatApiDetail(error)
  if (formatted) return formatted
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return 'Generation failed.'
  }
}

/** Steps that ended with status `failed`. */
export function getFailedSteps(job: GenerationJob): GenerationStep[] {
  return (job.steps ?? []).filter((s) => s.status === 'failed')
}

/** First failure message for a step key, if that step failed. */
export function getStepFailure(job: GenerationJob | undefined, stepKey: string): string | null {
  if (!job) return null
  const step = (job.steps ?? []).find((s) => s.key === stepKey)
  if (!step || step.status !== 'failed') return null
  return formatStepError(step.error)
}

export function getProjectRunStatus(job: GenerationJob | undefined): ProjectRunStatus | null {
  if (!job) return null
  if (!job.done) return 'in_progress'
  const failed = getFailedSteps(job)
  if (failed.length === 0) return 'complete'
  const succeeded = job.steps.filter((s) => s.status === 'done').length
  if (succeeded === 0) return 'failed'
  return 'partial'
}

function isCancelledJob(job: GenerationJob): boolean {
  const failed = getFailedSteps(job)
  if (failed.length === 0) return false
  return failed.every((step) => formatStepError(step.error) === CANCELLED_STEP_ERROR)
}

function failedOutputLabels(job: GenerationJob): string[] {
  return getFailedSteps(job)
    .filter((step) => step.key !== 'extract')
    .map((step) => step.label.replace(/^Generating /, ''))
}

/** User-facing status chip for library and dashboard project cards. */
export function getProjectStatusDisplay(job: GenerationJob | undefined): ProjectStatusDisplay | null {
  if (!job) return null

  const runStatus = getProjectRunStatus(job)
  if (!runStatus || runStatus === 'complete') return null

  if (runStatus === 'in_progress') {
    return {
      label: 'In progress',
      variant: 'active',
      title: 'This project is still being generated.',
    }
  }

  if (isCancelledJob(job)) {
    const succeeded = job.steps.filter((step) => step.status === 'done').length
    return {
      label: 'Generation cancelled',
      variant: 'muted',
      title:
        succeeded > 0
          ? 'Generation was cancelled. Finished outputs are still available.'
          : 'Generation was cancelled before any outputs completed.',
    }
  }

  if (runStatus === 'failed') {
    const firstError = getFailedSteps(job)[0]
    return {
      label: 'Generation unsuccessful',
      variant: 'error',
      title: firstError
        ? formatStepError(firstError.error)
        : 'We could not generate any outputs for this project.',
    }
  }

  const unavailable = failedOutputLabels(job)
  const readyCount = job.outputs.filter((output) => {
    const step = job.steps.find((s) => s.key === output)
    return step?.status === 'done'
  }).length

  return {
    label: readyCount > 0 ? 'Partially complete' : 'Needs attention',
    variant: 'warning',
    title:
      unavailable.length > 0
        ? `Unavailable: ${unavailable.join(', ')}. Other outputs may still be usable.`
        : 'Some steps did not complete successfully.',
  }
}

/** Jobs that are still generating, newest first. */
export function getInProgressJobs(jobs: Record<string, GenerationJob>): GenerationJob[] {
  return Object.values(jobs)
    .filter((job) => getProjectRunStatus(job) === 'in_progress')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function hasProjectFailures(job: GenerationJob | undefined): boolean {
  if (!job) return false
  return getFailedSteps(job).length > 0
}

/** Step for an output type (quiz, slides, …), if present on the job. */
export function getOutputStep(
  job: GenerationJob | undefined,
  stepKey: OutputTypeId,
): GenerationStep | undefined {
  if (!job) return undefined
  return job.steps.find((s) => s.key === stepKey)
}

/** True when an output step completed successfully and has persisted result data. */
export function hasOutputResult(job: GenerationJob, output: OutputTypeId): boolean {
  const { results } = job
  switch (output) {
    case 'explanation':
      return Boolean(results.explanation?.markdown.trim())
    case 'quiz':
      return Boolean(results.quiz?.length)
    case 'slides':
      return Boolean(results.slides?.deckId)
    case 'flashcards':
      return Boolean(results.flashcards?.cards?.length)
    case 'audio':
      return Boolean(results.audio?.audioId)
    case 'infographic':
      return Boolean(results.infographic?.dataUrl)
    case 'illustration':
      return Boolean(results.illustration?.dataUrl)
    case 'video':
      return Boolean(results.video?.videoId)
    default:
      return false
  }
}

export function isOutputReady(
  job: GenerationJob | undefined,
  output: OutputTypeId,
): boolean {
  if (!job) return false
  const step = getOutputStep(job, output)
  return step?.status === 'done' && hasOutputResult(job, output)
}

/**
 * True while this output step is pending or actively generating.
 * Works for single-output regeneration on already-complete projects too.
 */
export function isOutputStepActive(
  job: GenerationJob | undefined,
  stepKey: OutputTypeId,
): boolean {
  if (!job) return false
  const step = getOutputStep(job, stepKey)
  if (!step) return false
  return step.status === 'pending' || step.status === 'in_progress'
}

/** User-facing loader label for an output step on an active pipeline run. */
export function getOutputGeneratingLabel(
  job: GenerationJob | undefined,
  stepKey: OutputTypeId,
  fallback: string,
): string {
  const step = getOutputStep(job, stepKey)
  if (!step) return fallback
  if (step.status === 'in_progress') return step.label
  if (step.status === 'pending') return `Queued — ${step.label}`
  return fallback
}
