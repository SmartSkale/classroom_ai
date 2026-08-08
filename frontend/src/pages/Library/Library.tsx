import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { DownloadAllButton } from '../../components/DownloadAllButton'
import { countReadyOutputs } from '../../utils/downloadProjectBundle'
import { AssignToGroupModal } from '../../components/AssignToGroupModal'
import { Loader } from '../../components/Loader'
import { ProjectStatusBadge } from '../../components/ProjectStatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useGeneration } from '../../context/generation-context'
import { useFetch } from '../../hooks/useFetch'
import { projectService, type Project } from '../../services/projectService'
import { getProjectRunStatus, isOutputReady, isOutputStepActive } from '../../utils/projectStatus'
import {
  ACTIVE_GENERATION_JOB_KEY,
  OUTPUT_TYPES,
  ROUTES,
  processingRoute,
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
import { formatRelativeTime } from '../../utils/formatDate'
import { canCreateContent, canManageGroups, getLibrarySubtitle } from '../../utils/roles'
import type { ProjectType } from '../../utils/projectStorage'
import './Library.css'

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

function outputRoute(id: string, output: OutputTypeId): string {
  switch (output) {
    case 'quiz':
      return quizRoute(id)
    case 'slides':
      return slidesRoute(id)
    case 'flashcards':
      return flashcardsRoute(id)
    case 'audio':
      return audioRoute(id)
    case 'video':
      return videoRoute(id)
    case 'infographic':
      return infographicRoute(id)
    case 'illustration':
      return illustrationRoute(id)
    default:
      return projectRoute(id)
  }
}

function outputLabel(id: OutputTypeId): string {
  return OUTPUT_TYPES.find((t) => t.id === id)?.label ?? id
}

export function Library() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { regenerateProject, jobs, deleteProject } = useGeneration()
  const [query, setQuery] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [assignProject, setAssignProject] = useState<Project | null>(null)

  const fetchProjects = useCallback(() => projectService.listProjects(), [])
  const {
    data: projects,
    loading,
    error,
    refetch,
  } = useFetch<Project[]>(fetchProjects)

  const filtered = useMemo(() => {
    if (!projects) return []
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, query])

  function openProject(project: Project) {
    const runStatus = getProjectRunStatus(jobs[project.id])
    if (runStatus === 'in_progress') {
      navigate(processingRoute(project.id))
      return
    }
    navigate(projectRoute(project.id), { state: { name: project.name } })
  }

  async function handleRegenerate(project: Project) {
    setRegeneratingId(project.id)
    try {
      const jobId = await regenerateProject(project.id)
      if (jobId) {
        sessionStorage.setItem(ACTIVE_GENERATION_JOB_KEY, jobId)
        navigate(processingRoute(jobId))
      } else {
        window.alert('Could not start regeneration. Open the project once, then try again.')
      }
    } catch {
      window.alert('Could not start regeneration. Please try again.')
    } finally {
      setRegeneratingId(null)
    }
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return
    await deleteProject(project.id)
    refetch()
  }

  if (!canCreateContent(user)) {
    return <Navigate to={ROUTES.dashboard} replace />
  }

  return (
    <div className="library">
      <header className="library-header">
        <div>
          <h1>Project Library</h1>
          <p className="library-subtitle">{getLibrarySubtitle(user)}</p>
        </div>
        <Button variant="primary" onClick={() => navigate(ROUTES.upload)}>
          Upload Content
        </Button>
      </header>

      <div className="library-toolbar">
        <input
          type="search"
          className="library-search"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search projects"
        />
      </div>

      {loading && <Loader label="Loading your library…" />}

      {error && (
        <div className="library-error" role="alert">
          <p>Could not load projects.</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="library-empty">
          <p>{query ? 'No projects match your search.' : 'No projects yet.'}</p>
          <Button variant="primary" onClick={() => navigate(ROUTES.upload)}>
            Create your first project
          </Button>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="library-list">
          {filtered.map((project) => {
            const meta = TYPE_META[project.type]
            const job = jobs[project.id]
            const readyCount = job ? countReadyOutputs(job) : 0
            return (
              <li key={project.id} className="library-card">
                <button
                  type="button"
                  className="library-card-main"
                  onClick={() => openProject(project)}
                >
                  <span className={`library-thumb ${meta.className}`} aria-hidden="true">
                    {meta.icon}
                  </span>
                  <span className="library-card-body">
                    <span className="library-name">{project.name}</span>
                    <span className="library-meta">
                      <span className={`library-badge ${meta.className}`}>{meta.label}</span>
                      <span>{formatRelativeTime(project.updatedAt)}</span>
                      <ProjectStatusBadge job={job} />
                    </span>
                  </span>
                </button>

                <div className="library-outputs">
                  {project.outputs.map((output) => {
                    const outputGenerating = isOutputStepActive(job, output)
                    const outputReady = isOutputReady(job, output)
                    const outputUnavailable = Boolean(job?.done && !outputReady && !outputGenerating)
                    return (
                    <button
                      key={output}
                      type="button"
                      className={`library-output-chip${
                        outputGenerating ? ' library-output-chip-generating' : ''
                      }${outputUnavailable ? ' library-output-chip-unavailable' : ''}`}
                      disabled={outputUnavailable}
                      onClick={() =>
                        navigate(outputRoute(project.id, output), {
                          state: { name: project.name },
                        })
                      }
                    >
                      {outputGenerating
                        ? `${outputLabel(output)}…`
                        : outputUnavailable
                          ? `${outputLabel(output)} unavailable`
                          : outputLabel(output)}
                    </button>
                    )
                  })}
                </div>

                <div className="library-actions">
                  <DownloadAllButton
                    job={job}
                    variant="outline"
                    size="sm"
                    compact
                  />
                  {canManageGroups(user) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignProject(project)}
                    >
                      Assign to Group
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={regeneratingId === project.id}
                    onClick={() => void handleRegenerate(project)}
                  >
                    {regeneratingId === project.id ? 'Starting…' : 'Regenerate'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDelete(project)}
                  >
                    Delete
                  </Button>
                </div>
                {job && readyCount > 0 && (
                  <p className="library-ready-hint">
                    {readyCount} of {project.outputs.length} outputs ready
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {assignProject && (
        <AssignToGroupModal
          open
          onClose={() => setAssignProject(null)}
          projectId={assignProject.id}
          projectName={assignProject.name}
          outputs={assignProject.outputs}
          job={jobs[assignProject.id]}
        />
      )}
    </div>
  )
}

export default Library
