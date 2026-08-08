import type { GenerationJob } from '../../context/generation-context'
import { CANCELLED_STEP_ERROR, formatStepError, getFailedSteps, getStepFailure } from '../../utils/projectStatus'
import './ProjectFailures.css'

interface ProjectFailuresProps {
  job: GenerationJob | undefined
  /** When set, only show the failure for this step (e.g. "quiz"). */
  stepKey?: string
  /** Heading for the full summary block (default: "Generation issues"). */
  title?: string
}

export function ProjectFailures({
  job,
  stepKey,
  title = 'Generation issues',
}: ProjectFailuresProps) {
  if (!job) return null

  if (stepKey) {
    const message = getStepFailure(job, stepKey)
    if (!message) return null
    const step = job.steps.find((s) => s.key === stepKey)
    const label = (step?.label ?? 'Output').replace(/^Generating /, '')
    const cancelled = message === CANCELLED_STEP_ERROR
    return (
      <div className="project-failures project-failures-single" role="alert">
        <p>
          {cancelled ? (
            <>
              <strong>{label}</strong> was not generated — generation was cancelled.
            </>
          ) : (
            <>
              <strong>{label} failed:</strong> {message}
            </>
          )}
        </p>
      </div>
    )
  }

  const failed = getFailedSteps(job)
  if (failed.length === 0) return null

  return (
    <section className="project-failures" aria-label="Generation issues">
      <h2 className="project-failures-title">{title}</h2>
      <ul className="project-failures-list">
        {failed.map((step) => {
          const reason =
            step.error !== undefined && formatStepError(step.error) === CANCELLED_STEP_ERROR
              ? 'Generation cancelled'
              : step.error !== undefined
                ? formatStepError(step.error)
                : null
          return (
          <li key={step.key}>
            <span className="project-failures-label">{step.label}</span>
            {reason && <span className="project-failures-reason">{reason}</span>}
          </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ProjectFailures
