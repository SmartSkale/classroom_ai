import type { GenerationJob, GenerationStep } from '../context/generation-context'
import type { OutputTypeId } from './constants'

export type ProjectRunStatus = 'in_progress' | 'complete' | 'partial' | 'failed'

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
