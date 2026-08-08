import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { DownloadAllButton } from '../../components/DownloadAllButton'
import { Loader } from '../../components/Loader'
import { Modal } from '../../components/Modal'
import { useGeneration, type GenerationJob, type StepStatus } from '../../context/generation-context'
import {
  ACTIVE_GENERATION_JOB_KEY,
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
import { formatStepError } from '../../utils/projectStatus'
import './Processing.css'

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

function hasSuccessfulOutput(job: GenerationJob): boolean {
  return job.outputs.some((output) => {
    const step = job.steps.find((s) => s.key === output)
    return step?.status === 'done'
  })
}

/** Redirect bare `/processing` to the active job or upload. */
export function ProcessingIndex() {
  const activeId = sessionStorage.getItem(ACTIVE_GENERATION_JOB_KEY)
  if (activeId) {
    return <Navigate to={`/processing/${activeId}`} replace />
  }
  return <Navigate to={ROUTES.upload} replace />
}

export function Processing() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { jobs, loadProject, hydrated, cancelGeneration } = useGeneration()

  const job = jobId ? jobs[jobId] : undefined
  const [loading, setLoading] = useState(Boolean(jobId && !job))

  useEffect(() => {
    if (!jobId) return
    sessionStorage.setItem(ACTIVE_GENERATION_JOB_KEY, jobId)
  }, [jobId])

  useEffect(() => {
    if (!jobId || job) {
      setLoading(false)
      return
    }
    if (!hydrated) return

    let cancelled = false
    setLoading(true)
    void loadProject(jobId).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [jobId, job, loadProject, hydrated])

  const resolvedJob = jobId ? jobs[jobId] : undefined

  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!resolvedJob?.done || !jobId) return
    if (!hasSuccessfulOutput(resolvedJob)) return
    sessionStorage.removeItem(ACTIVE_GENERATION_JOB_KEY)
    const t = setTimeout(() => {
      navigate(firstReadyRoute(resolvedJob), {
        replace: true,
        state: { name: resolvedJob.name, text: resolvedJob.sourceText },
      })
    }, 1200)
    return () => clearTimeout(t)
  }, [resolvedJob?.done, jobId, navigate, resolvedJob])

  if (!jobId) {
    return <Navigate to={ROUTES.upload} replace />
  }

  if (loading || (!resolvedJob && !hydrated)) {
    return (
      <div className="processing processing-loading">
        <Loader label="Loading generation status…" />
      </div>
    )
  }

  if (!resolvedJob) {
    return <Navigate to={ROUTES.upload} replace />
  }

  function confirmCancel() {
    if (!jobId) return
    cancelGeneration(jobId)
    sessionStorage.removeItem(ACTIVE_GENERATION_JOB_KEY)
    setConfirmOpen(false)
    navigate(ROUTES.dashboard, { replace: true })
  }

  const failedStep = resolvedJob.steps.find((s) => s.status === 'failed')
  const extractFailed = resolvedJob.steps.find((s) => s.key === 'extract' && s.status === 'failed')
  const anyOutputSucceeded = hasSuccessfulOutput(resolvedJob)
  const activeStep = resolvedJob.steps.find((s) => s.status === 'in_progress')

  return (
    <div className="processing">
      <header className="processing-header">
        <p className="processing-eyebrow">AI Processing</p>
        <h1 className="processing-title">{resolvedJob.name}</h1>
      </header>

      <div className="processing-bar" aria-label="Overall progress">
        <div className="processing-bar-track">
          <div
            className="processing-bar-fill"
            style={{ width: `${resolvedJob.progress}%` }}
          />
        </div>
        <span className="processing-percent">{resolvedJob.progress}%</span>
      </div>

      {activeStep && (
        <p className="processing-live" role="status">
          Now generating: <strong>{activeStep.label}</strong>
        </p>
      )}

      {extractFailed && (
        <div className="processing-alert" role="alert">
          <strong>Could not read your uploaded file.</strong>{' '}
          {formatStepError(extractFailed.error)}
          {!anyOutputSucceeded ? (
            <>
              {' '}
              No lesson content was generated. Upload a PDF with selectable text, paste your content
              as plain text, or try image uploads instead.
            </>
          ) : (
            <> Other outputs were generated using your pasted text.</>
          )}
        </div>
      )}

      {failedStep && !extractFailed && (
        <div className="processing-alert" role="alert">
          {failedStep.label.replace('Generating ', '')} failed
          {failedStep.error !== undefined
            ? `: ${formatStepError(failedStep.error)}`
            : '.'}{' '}
          Other outputs were generated where possible.
        </div>
      )}

      <section className="processing-status">
        <h2 className="processing-status-title">Status</h2>
        <ul className="processing-steps">
          {resolvedJob.steps.map((step) => (
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
        Your project is saved automatically. You can browse other pages — use the progress banner
        at the top or return here anytime to check status.
      </p>

      {resolvedJob.done && anyOutputSucceeded && (
        <section className="processing-download" aria-label="Download all materials">
          <DownloadAllButton job={resolvedJob} variant="primary" size="md" fullWidth />
        </section>
      )}

      <div className="processing-actions">
        {resolvedJob.done && !anyOutputSucceeded ? (
          <Button variant="primary" onClick={() => navigate(ROUTES.upload)}>
            Back to upload
          </Button>
        ) : null}
        <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={resolvedJob.done}>
          Cancel Generation
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel generation?"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Keep going
            </Button>
            <Button variant="outline" onClick={confirmCancel}>
              Cancel generation
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Remaining steps will stop and any outputs already finished stay saved in your Library.
        </p>
      </Modal>
    </div>
  )
}

export default Processing
