import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { StudentDashboard } from '../StudentDashboard'
import { projectService, type Project } from '../../services/projectService'
import { ROUTES, projectRoute } from '../../utils/constants'
import { formatRelativeTime } from '../../utils/formatDate'
import { canCreateContent } from '../../utils/roles'
import type { ProjectType } from '../../utils/projectStorage'
import './Dashboard.css'

const TYPE_META: Record<ProjectType, { label: string; icon: string; className: string }> = {
  explanation: { label: 'Lesson', icon: '📖', className: 'type-explanation' },
  quiz: { label: 'Quiz', icon: '❓', className: 'type-quiz' },
  slides: { label: 'Slides', icon: '🖥️', className: 'type-slides' },
  flashcards: { label: 'Cards', icon: '🗂️', className: 'type-flashcards' },
  audio: { label: 'Audio', icon: '🎧', className: 'type-audio' },
  video: { label: 'Video', icon: '🎬', className: 'type-video' },
  infographic: { label: 'Infographic', icon: '📊', className: 'type-infographic' },
  illustration: { label: 'Illustration', icon: '🎨', className: 'type-illustration' },
}

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const fetchProjects = useCallback(() => projectService.getRecentProjects(6), [])
  const fetchUsage = useCallback(() => projectService.getUsage(), [])

  const {
    data: projects,
    loading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useFetch<Project[]>(fetchProjects)
  const { data: usage } = useFetch(fetchUsage)

  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const isCreator = canCreateContent(user)

  if (!isCreator) {
    return <StudentDashboard firstName={firstName} />
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-greeting">Welcome back, {firstName}</h1>
        <p className="dashboard-subtitle">
          Upload a chapter, generate materials, and download assets for your class.
        </p>
      </header>

      <section className="dashboard-section" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="dashboard-section-title">
          Recent Projects
        </h2>

        {projectsLoading && <Loader label="Loading recent projects…" />}

        {projectsError && (
          <div className="dashboard-error" role="alert">
            <p>Could not load recent projects. Refresh to try again.</p>
            <Button variant="outline" size="sm" onClick={refetchProjects}>
              Refresh
            </Button>
          </div>
        )}

        {!projectsLoading && !projectsError && projects && projects.length === 0 && (
          <div className="dashboard-empty">
            <p>No projects yet. Upload a PDF chapter or paste text to create your first lesson.</p>
            <Button variant="primary" onClick={() => navigate(ROUTES.upload)}>
              Upload Content
            </Button>
          </div>
        )}

        {!projectsLoading && !projectsError && projects && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((project) => {
              const meta = TYPE_META[project.type]
              return (
                <button
                  key={project.id}
                  className="project-card"
                  onClick={() =>
                    navigate(projectRoute(project.id), { state: { name: project.name } })
                  }
                >
                  <div className={`project-thumb ${meta.className}`} aria-hidden="true">
                    {meta.icon}
                  </div>
                  <div className="project-body">
                    <span className="project-name">{project.name}</span>
                    <div className="project-meta">
                      <span className={`project-badge ${meta.className}`}>{meta.label}</span>
                      <span className="project-date">
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </div>
                    <span className="project-outputs-count">
                      {project.outputs.length} output{project.outputs.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="quickstart-heading">
        <h2 id="quickstart-heading" className="dashboard-section-title">
          Quick Start
        </h2>
        <div className="dashboard-actions">
          <Button variant="primary" onClick={() => navigate(ROUTES.upload)}>
            Upload Content
          </Button>
          <Button variant="outline" onClick={() => navigate(ROUTES.library)}>
            Browse Library
          </Button>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="dashboard-section-title">
          Usage {usage ? usage.periodLabel : 'This Month'}
        </h2>
        {usage ? (
          <div className="usage">
            <div className="usage-bar" aria-hidden="true">
              <div
                className="usage-fill"
                style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
              />
            </div>
            <p className="usage-label">
              <strong>{usage.used}</strong> / {usage.limit} generations
            </p>
          </div>
        ) : (
          <Loader label="Loading usage…" />
        )}
      </section>
    </div>
  )
}

export default Dashboard
