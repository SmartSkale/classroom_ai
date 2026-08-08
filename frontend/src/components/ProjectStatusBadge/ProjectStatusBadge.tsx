import type { GenerationJob } from '../../context/generation-context'
import { getProjectStatusDisplay } from '../../utils/projectStatus'
import './ProjectStatusBadge.css'

interface ProjectStatusBadgeProps {
  job: GenerationJob | undefined
}

export function ProjectStatusBadge({ job }: ProjectStatusBadgeProps) {
  const display = getProjectStatusDisplay(job)
  if (!display) return null

  return (
    <span
      className={`status-badge status-badge--${display.variant}`}
      title={display.title}
    >
      {display.label}
    </span>
  )
}

export default ProjectStatusBadge
