import { Link, useLocation } from 'react-router-dom'
import { useGeneration } from '../../context/generation-context'
import { processingRoute } from '../../utils/constants'
import { getInProgressJobs } from '../../utils/projectStatus'
import './GenerationProgressBanner.css'

function GeneratingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="gen-progress-icon" aria-hidden="true">
      <path
        d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

export function GenerationProgressBanner() {
  const { jobs } = useGeneration()
  const location = useLocation()
  const inProgress = getInProgressJobs(jobs)

  if (inProgress.length === 0) return null

  const primary = inProgress[0]
  const processingPath = processingRoute(primary.id)
  const onProcessingPage = location.pathname === processingPath

  if (onProcessingPage) return null

  const activeStep = primary.steps.find((s) => s.status === 'in_progress')
  const extraCount = inProgress.length - 1

  return (
    <div className="gen-progress-banner" role="status" aria-live="polite">
      <div className="gen-progress-banner-inner">
        <GeneratingIcon />
        <div className="gen-progress-banner-text">
          <p className="gen-progress-banner-title">
            Generating <strong>{primary.name}</strong>
          </p>
          <p className="gen-progress-banner-detail">
            {activeStep ? activeStep.label : 'Processing…'} · {primary.progress}% complete
            {extraCount > 0 && ` · ${extraCount} more in queue`}
          </p>
        </div>
        <Link to={processingPath} className="gen-progress-banner-link">
          View progress
        </Link>
      </div>
      <div className="gen-progress-banner-track" aria-hidden="true">
        <div className="gen-progress-banner-fill" style={{ width: `${primary.progress}%` }} />
      </div>
    </div>
  )
}

export default GenerationProgressBanner
