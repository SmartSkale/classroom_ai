import { OUTPUT_TYPES, type OutputTypeId } from '../utils/constants'

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed'

export interface JobStep {
  key: string
  label: string
  status: StepStatus
  etaSeconds: number
}

export interface JobSnapshot {
  progress: number
  steps: JobStep[]
  done: boolean
  failedLabel: string | null
}

/** How long each step takes in the simulation. */
const STEP_MS = 5000

function outputLabel(id: OutputTypeId): string {
  return OUTPUT_TYPES.find((t) => t.id === id)?.label ?? id
}

/** The ordered pipeline: extract source first, then each selected output. */
export function buildSteps(outputs: OutputTypeId[]): Array<{ key: string; label: string }> {
  return [
    { key: 'extract', label: 'Extracting content' },
    ...outputs.map((o) => ({ key: o, label: `Generating ${outputLabel(o)}` })),
  ]
}

/**
 * Compute a job snapshot from elapsed time. In production this would be replaced
 * by a WebSocket subscription or `GET /jobs/{id}` polled every 5 seconds:
 *   const { data } = await api.get<JobSnapshot>(`/jobs/${id}`)
 *   return data
 *
 * `failedSteps` lets the (future) backend mark individual outputs as failed while
 * the rest continue — the UI already renders that state.
 */
export function simulateJob(
  startedAt: number,
  outputs: OutputTypeId[],
  failedSteps: string[] = [],
): JobSnapshot {
  const base = buildSteps(outputs)
  const total = base.length * STEP_MS
  const elapsed = Date.now() - startedAt
  const completedCount = Math.floor(elapsed / STEP_MS)
  const allDone = elapsed >= total

  let failedLabel: string | null = null

  const steps: JobStep[] = base.map((step, index) => {
    const failed = failedSteps.includes(step.key)
    let status: StepStatus = 'pending'
    let etaSeconds = 0

    if (index < completedCount || allDone) {
      status = failed ? 'failed' : 'done'
    } else if (index === completedCount) {
      status = failed ? 'failed' : 'in_progress'
      etaSeconds = Math.max(1, Math.ceil((total - elapsed) / 1000))
    }

    if (failed && !failedLabel) {
      failedLabel = step.key === 'extract' ? 'Content extraction' : step.label.replace('Generating ', '')
    }
    return { ...step, status, etaSeconds }
  })

  return {
    progress: Math.min(100, Math.round((elapsed / total) * 100)),
    steps,
    done: allDone,
    failedLabel,
  }
}

export const jobService = { buildSteps, simulateJob }
export default jobService
