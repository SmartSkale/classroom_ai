import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { DownloadAllButton } from '../../components/DownloadAllButton'
import { Modal } from '../../components/Modal'
import { useGeneration, type GenerationJob, type StepStatus } from '../../context/generation-context'
import {
  ROUTES,
  audioRoute,
  flashcardsRoute,
  illustrationRoute,
  infographicRoute,
  projectRoute,
  quizRoute,
  slidesRoute,
  videoRoute,
  type OutputTypeId,
} from '../../utils/constants'
import './Processing.css'

interface ProcessingState {
  jobId: string
}

const STATUS_TAG: Record<StepStatus, string> = {
  done: 'DONE',
  in_progress: '>>>>',
  pending: '····',
  failed: 'FAIL',
}

const OUTPUT_ROUTE: Record<OutputTypeId, (id: string) => string> = {
  explanation: projectRoute,
  quiz: quizRoute,
  slides: slidesRoute,
  flashcards: flashcardsRoute,
  audio: audioRoute,
  video: videoRoute,
  infographic: infographicRoute,
  illustration: illustrationRoute,
}

function firstReadyRoute(job: GenerationJob): string {
  for (const output of job.outputs) {
    const step = job.steps.find((s) => s.key === output)
    if (step?.status === 'done') {
      return OUTPUT_ROUTE[output](job.id)
    }
  }
  return projectRoute(job.id)
}

export function Processing() {
  const location = useLocation()
  const navigate = useNavigate()
  const { jobs } = useGeneration()
  const state = (location.state ?? null) as ProcessingState | null

  const jobId = state?.jobId
  const job = jobId ? jobs[jobId] : undefined

  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!job?.done || !jobId) return
    const t = setTimeout(() => {
      navigate(firstReadyRoute(job), {
        replace: true,
        state: { name: job.name, text: job.sourceText },
      })
    }, 1200)
    return () => clearTimeout(t)
  }, [job?.done, jobId, navigate, job])

  if (!jobId || !job) {
    return <Navigate to={ROUTES.upload} replace />
  }

  function confirmCancel() {
    navigate(ROUTES.dashboard, { replace: true })
  }

  const failedStep = job.steps.find((s) => s.status === 'failed')
  const activeStep = job.steps.find((s) => s.status === 'in_progress')

  return (
    <div className="processing">
      <header className="processing-header">
        <p className="processing-eyebrow">AI Processing</p>
        <h1 className="processing-title">{job.name}</h1>
      </header>

      <div className="processing-bar" aria-label="Overall progress">
        <div className="processing-bar-track">
          <div className="processing-bar-fill" style={{ width: `${job.progress}%` }} />
        </div>
        <span className="processing-percent">{job.progress}%</span>
      </div>

      {activeStep && (
        <p className="processing-live" role="status">
          Now generating: <strong>{activeStep.label}</strong>
        </p>
      )}

      {failedStep && (
        <div className="processing-alert" role="alert">
          {failedStep.label.replace('Generating ', '')} failed
          {failedStep.error ? `: ${failedStep.error}` : '.'} Other outputs were generated
          where possible.
        </div>
      )}

      <section className="processing-status">
        <h2 className="processing-status-title">Status</h2>
        <ul className="processing-steps">
          {job.steps.map((step) => (
            <li key={step.key} className={`processing-step status-${step.status}`}>
              <span className="step-tag" aria-hidden="true">
                {STATUS_TAG[step.status]}
              </span>
              <span className="step-label">{step.label}</span>
              {step.status === 'in_progress' && <span className="step-eta">In progress</span>}
              {step.status === 'failed' && <span className="step-eta step-eta-fail">failed</span>}
            </li>
          ))}
        </ul>
      </section>

      <p className="processing-note">
        Your project is saved automatically. You can return to the Library anytime to review or
        regenerate materials.
      </p>

      {job.done && (
        <section className="processing-download" aria-label="Download all materials">
          <DownloadAllButton job={job} variant="primary" size="md" fullWidth />
        </section>
      )}

      <div className="processing-actions">
        <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={job.done}>
          Cancel Generation
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel generation?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep going
            </Button>
            <Button variant="danger" onClick={confirmCancel}>
              Cancel generation
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Generation will continue in the background until you leave. Partial results are still
          saved to your Library.
        </p>
      </Modal>
    </div>
  )
}

export default Processing
