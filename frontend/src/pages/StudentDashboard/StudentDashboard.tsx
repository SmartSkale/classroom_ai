import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useGeneration } from '../../context/generation-context'
import { useFetch } from '../../hooks/useFetch'
import { groupService } from '../../services/groupService'
import {
  audioRoute,
  flashcardsRoute,
  projectRoute,
  quizResultsRoute,
  quizTakeRoute,
  videoRoute,
} from '../../utils/constants'
import type { OutputTypeId } from '../../utils/constants'
import { listStudentAssignments } from '../../utils/studentAssignments'
import { RelativeTime } from '../../components/RelativeTime'
import './StudentDashboard.css'

export interface StudentLesson {
  projectId: string
  name: string
  outputs: OutputTypeId[]
  assignedAt: string
  groupName?: string
  lastQuizPercent?: number
  lastQuizPassed?: boolean
}

interface StudentDashboardProps {
  firstName: string
}

function mergeLessons(
  apiLessons: StudentLesson[],
  localLessons: ReturnType<typeof listStudentAssignments>,
): StudentLesson[] {
  const byId = new Map<string, StudentLesson>()

  for (const lesson of apiLessons) {
    byId.set(lesson.projectId, lesson)
  }

  for (const local of localLessons) {
    const existing = byId.get(local.projectId)
    if (existing) {
      byId.set(local.projectId, {
        ...existing,
        lastQuizPercent: local.lastQuizPercent ?? existing.lastQuizPercent,
        lastQuizPassed: local.lastQuizPassed ?? existing.lastQuizPassed,
      })
    } else {
      byId.set(local.projectId, {
        projectId: local.projectId,
        name: local.name,
        outputs: local.outputs,
        assignedAt: local.assignedAt,
        lastQuizPercent: local.lastQuizPercent,
        lastQuizPassed: local.lastQuizPassed,
      })
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  )
}

export function StudentDashboard({ firstName }: StudentDashboardProps) {
  const navigate = useNavigate()
  const { importSharedJob } = useGeneration()

  const fetchLessons = useCallback(async () => {
    const apiRows = await groupService.listMyAssignments()
    const apiLessons: StudentLesson[] = apiRows.map((row) => ({
      projectId: row.project_id,
      name: row.title,
      outputs: row.outputs,
      assignedAt: row.assigned_at,
      groupName: row.group_name,
      lastQuizPercent: row.last_quiz_percent ?? undefined,
      lastQuizPassed: row.last_quiz_passed ?? undefined,
    }))

    for (const row of apiRows) {
      if (row.content_snapshot) {
        importSharedJob(row.content_snapshot)
      }
    }

    const localLessons = listStudentAssignments()

    const merged = mergeLessons(apiLessons, localLessons)
    return merged
  }, [importSharedJob])

  const { data: lessons, loading, error, refetch } = useFetch<StudentLesson[]>(
    fetchLessons,
    [importSharedJob],
  )

  return (
    <div className="student-dashboard">
      <header className="student-dashboard-header">
        <h1>Welcome, {firstName}</h1>
        <p className="student-dashboard-subtitle">
          Your assigned lessons are below. Read the explanation, take the quiz, then review
          flashcards, audio, or video.
        </p>
      </header>

      <section aria-labelledby="assigned-heading">
        <h2 id="assigned-heading" className="student-dashboard-section-title">
          Assigned Content
        </h2>

        {loading && <Loader label="Loading your lessons…" />}

        {error && (
          <div className="student-dashboard-empty">
            <p>Could not load your assigned lessons.</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && lessons && lessons.length === 0 && (
          <div className="student-dashboard-empty">
            <p>No lessons assigned yet.</p>
            <p className="student-dashboard-empty-hint">
              Your teacher will add you to a class group and assign content. You can also open a
              shared link from your teacher.
            </p>
          </div>
        )}

        {!loading && !error && lessons && lessons.length > 0 && (
          <ul className="student-lesson-list">
            {lessons.map((lesson) => (
              <li key={lesson.projectId} className="student-lesson-card">
                <div className="student-lesson-head">
                  <h3 className="student-lesson-name">{lesson.name}</h3>
                  {lesson.groupName && (
                    <span className="student-lesson-group">{lesson.groupName}</span>
                  )}
                  <RelativeTime
                    className="student-lesson-date"
                    value={lesson.assignedAt}
                    prefix="Assigned "
                  />
                  {lesson.lastQuizPercent != null && (
                    <span
                      className={`student-quiz-badge${lesson.lastQuizPassed ? ' is-pass' : ' is-fail'}`}
                    >
                      Quiz: {lesson.lastQuizPercent}%
                    </span>
                  )}
                </div>
                <div className="student-lesson-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      navigate(projectRoute(lesson.projectId), { state: { name: lesson.name } })
                    }
                  >
                    Read Explanation
                  </Button>
                  {lesson.outputs.includes('quiz') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(quizTakeRoute(lesson.projectId), { state: { name: lesson.name } })
                      }
                    >
                      Take Quiz
                    </Button>
                  )}
                  {lesson.lastQuizPercent != null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(quizResultsRoute(lesson.projectId), {
                          state: { name: lesson.name },
                        })
                      }
                    >
                      Quiz Results
                    </Button>
                  )}
                  {lesson.outputs.includes('flashcards') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(flashcardsRoute(lesson.projectId), { state: { name: lesson.name } })
                      }
                    >
                      Flashcards
                    </Button>
                  )}
                  {lesson.outputs.includes('audio') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(audioRoute(lesson.projectId), { state: { name: lesson.name } })
                      }
                    >
                      Audio
                    </Button>
                  )}
                  {lesson.outputs.includes('video') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(videoRoute(lesson.projectId), { state: { name: lesson.name } })
                      }
                    >
                      Video
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default StudentDashboard
