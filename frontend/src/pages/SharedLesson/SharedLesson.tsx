import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useGeneration } from '../../context/generation-context'
import { ROUTES, projectRoute } from '../../utils/constants'
import { addStudentAssignment } from '../../utils/studentAssignments'
import { loadSharedProject } from '../../utils/sharedProjects'

/**
 * Entry point for teacher-shared lesson links (/q/:id).
 * Loads the published snapshot, adds the lesson to the student's assignments,
 * then opens the explanation.
 */
export function SharedLesson() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, status } = useAuth()
  const { jobs, importSharedJob } = useGeneration()

  useEffect(() => {
    if (status === 'loading' || !isAuthenticated || !id) return

    const snapshot = loadSharedProject(id) ?? jobs[id]
    if (snapshot) {
      importSharedJob(snapshot)
      addStudentAssignment({
        projectId: snapshot.id,
        name: snapshot.name,
        outputs: snapshot.outputs,
      })
    } else {
      addStudentAssignment({
        projectId: id,
        name: 'Shared lesson',
        outputs: ['explanation', 'quiz'],
      })
    }

    navigate(projectRoute(id), { replace: true, state: { name: snapshot?.name } })
  }, [id, isAuthenticated, status, jobs, importSharedJob, navigate])

  if (status === 'loading') return <Loader fullscreen label="Opening lesson…" />

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace state={{ from: `/q/${id}` }} />
  }

  return <Loader fullscreen label="Opening lesson…" />
}

export default SharedLesson
