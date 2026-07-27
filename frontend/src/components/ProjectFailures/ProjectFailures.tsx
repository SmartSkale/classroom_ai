import type { GenerationJob } from '../../context/generation-context'
import { formatStepError, getFailedSteps, getStepFailure } from '../../utils/projectStatus'
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
    return (
      <div className="project-failures project-failures-single" role="alert">
        <p>
          <strong>{label} failed:</strong> {message}
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
        {failed.map((step) => (
          <li key={step.key}>
            <span className="project-failures-label">{step.label}</span>
            {step.error !== undefined && (
              <span className="project-failures-reason">{formatStepError(step.error)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default ProjectFailures
