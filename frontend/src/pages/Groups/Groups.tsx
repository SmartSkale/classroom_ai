import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import {
  groupService,
  type GroupAssignment,
  type GroupDetail,
  type TeacherGroup,
} from '../../services/groupService'
import { quizService, type GroupQuizResultRow } from '../../services/quizService'
import { ROUTES } from '../../utils/constants'
import { canManageGroups } from '../../utils/roles'
import { formatRelativeTime } from '../../utils/formatDate'
import './Groups.css'

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'))
}

export function Groups() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<GroupDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<GroupAssignment[]>([])
  const [quizScoresFor, setQuizScoresFor] = useState<{
    groupId: number
    projectId: string
    title: string
  } | null>(null)
  const [quizScores, setQuizScores] = useState<GroupQuizResultRow[]>([])
  const [quizScoresLoading, setQuizScoresLoading] = useState(false)

  const fetchGroups = useCallback(() => groupService.listGroups(), [])
  const { data: groups, loading, error, refetch } = useFetch<TeacherGroup[]>(fetchGroups)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      await groupService.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setName('')
      setDescription('')
      refetch()
    } catch {
      setCreateError('Could not create group.')
    } finally {
      setCreating(false)
    }
  }

  async function loadDetail(groupId: number) {
    setDetailLoading(true)
    setMemberError(null)
    try {
      const [groupDetail, groupAssignments] = await Promise.all([
        groupService.getGroup(groupId),
        groupService.listGroupAssignments(groupId),
      ])
      setDetail(groupDetail)
      setAssignments(groupAssignments)
    } catch {
      setDetail(null)
      setAssignments([])
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (expandedId == null) {
      setDetail(null)
      setAssignments([])
      return
    }
    void loadDetail(expandedId)
  }, [expandedId])

  async function handleAddMembers(groupId: number) {
    const emails = parseEmails(emailInput)
    if (emails.length === 0) {
      setMemberError('Enter at least one valid email address.')
      return
    }
    setMemberError(null)
    try {
      await groupService.addMembers(groupId, emails)
      setEmailInput('')
      await loadDetail(groupId)
      refetch()
    } catch {
      setMemberError('Could not add students. Check the emails and try again.')
    }
  }

  async function handleRemoveMember(groupId: number, memberId: number) {
    try {
      await groupService.removeMember(groupId, memberId)
      await loadDetail(groupId)
      refetch()
    } catch {
      setMemberError('Could not remove student.')
    }
  }

  async function handleDeleteGroup(group: TeacherGroup) {
    if (!window.confirm(`Delete group “${group.name}”? Students will lose access to its assignments.`)) {
      return
    }
    try {
      await groupService.deleteGroup(group.id)
      if (expandedId === group.id) setExpandedId(null)
      refetch()
    } catch {
      window.alert('Could not delete group.')
    }
  }

  async function handleRemoveAssignment(groupId: number, assignmentId: number) {
    if (!window.confirm('Remove this assignment from the group?')) return
    try {
      await groupService.removeAssignment(groupId, assignmentId)
      await loadDetail(groupId)
      refetch()
    } catch {
      window.alert('Could not remove assignment.')
    }
  }

  async function handleViewQuizScores(groupId: number, projectId: string, title: string) {
    setQuizScoresFor({ groupId, projectId, title })
    setQuizScoresLoading(true)
    try {
      const rows = await quizService.getGroupQuizResults(groupId, projectId)
      setQuizScores(rows)
    } catch {
      setQuizScores([])
      window.alert('Could not load quiz scores.')
    } finally {
      setQuizScoresLoading(false)
    }
  }

  if (!canManageGroups(user)) {
    return <Navigate to={ROUTES.dashboard} replace />
  }

  return (
    <div className="groups-page">
      <header className="groups-header">
        <div>
          <h1>Class Groups</h1>
          <p className="groups-subtitle">
            Create groups, add student emails, and assign lessons from your library.
          </p>
        </div>
        <Link to={ROUTES.library}>
          <Button variant="outline">Go to Library</Button>
        </Link>
      </header>

      <section className="groups-create" aria-labelledby="create-group-heading">
        <h2 id="create-group-heading">Create a group</h2>
        <form className="groups-create-form" onSubmit={(e) => void handleCreate(e)}>
          <label>
            <span>Group name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Biology Period 2"
              required
              maxLength={255}
            />
          </label>
          <label>
            <span>Description (optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note for yourself"
              maxLength={2000}
            />
          </label>
          {createError && (
            <p className="groups-error" role="alert">
              {createError}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create Group'}
          </Button>
        </form>
      </section>

      <section aria-labelledby="groups-list-heading">
        <h2 id="groups-list-heading" className="groups-section-title">
          Your groups
        </h2>

        {loading && <Loader label="Loading groups…" />}

        {error && (
          <div className="groups-error-box" role="alert">
            <p>Could not load groups.</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && groups && groups.length === 0 && (
          <p className="groups-empty">No groups yet. Create one above to get started.</p>
        )}

        {!loading && groups && groups.length > 0 && (
          <ul className="groups-list">
            {groups.map((group) => {
              const expanded = expandedId === group.id
              return (
                <li key={group.id} className={`groups-card${expanded ? ' is-expanded' : ''}`}>
                  <button
                    type="button"
                    className="groups-card-head"
                    onClick={() => setExpandedId(expanded ? null : group.id)}
                    aria-expanded={expanded}
                  >
                    <span className="groups-card-name">{group.name}</span>
                    <span className="groups-card-meta">
                      {group.member_count} student{group.member_count === 1 ? '' : 's'} ·{' '}
                      {group.assignment_count} assignment
                      {group.assignment_count === 1 ? '' : 's'}
                    </span>
                  </button>

                  {expanded && (
                    <div className="groups-card-body">
                      {detailLoading && <Loader label="Loading group…" />}

                      {!detailLoading && detail && (
                        <>
                          <div className="groups-members">
                            <h3>Add students</h3>
                            <p className="groups-hint">
                              Enter one or more student emails, separated by commas or new lines.
                            </p>
                            <textarea
                              className="groups-email-input"
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              placeholder="student1@school.edu, student2@school.edu"
                              rows={3}
                            />
                            {memberError && (
                              <p className="groups-error" role="alert">
                                {memberError}
                              </p>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handleAddMembers(group.id)}
                            >
                              Add Students
                            </Button>

                            <h3 className="groups-subheading">Members</h3>
                            {detail.members.length === 0 ? (
                              <p className="groups-hint">No students added yet.</p>
                            ) : (
                              <ul className="groups-member-list">
                                {detail.members.map((member) => (
                                  <li key={member.id} className="groups-member-item">
                                    <span>
                                      {member.email}
                                      <span className={`groups-status groups-status-${member.status}`}>
                                        {member.status}
                                      </span>
                                    </span>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => void handleRemoveMember(group.id, member.id)}
                                    >
                                      Remove
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="groups-assignments">
                            <h3>Assigned content</h3>
                            {assignments.length === 0 ? (
                              <p className="groups-hint">
                                No content assigned yet. Use <strong>Assign to Group</strong> from
                                the Project Library.
                              </p>
                            ) : (
                              <ul className="groups-assignment-list">
                                {assignments.map((assignment) => (
                                  <li key={assignment.id} className="groups-assignment-item">
                                    <div>
                                      <span className="groups-assignment-title">{assignment.title}</span>
                                      <span className="groups-assignment-meta">
                                        Assigned {formatRelativeTime(assignment.assigned_at)}
                                      </span>
                                    </div>
                                    <div className="groups-assignment-actions">
                                      {assignment.outputs.includes('quiz') && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            void handleViewQuizScores(
                                              group.id,
                                              assignment.project_id,
                                              assignment.title,
                                            )
                                          }
                                        >
                                          Quiz Scores
                                        </Button>
                                      )}
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() =>
                                          void handleRemoveAssignment(group.id, assignment.id)
                                        }
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="groups-card-actions">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeleteGroup(group)}
                            >
                              Delete Group
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {quizScoresFor && (
        <section className="groups-quiz-scores" aria-labelledby="quiz-scores-heading">
          <h2 id="quiz-scores-heading">Quiz scores — {quizScoresFor.title}</h2>
          {quizScoresLoading && <Loader label="Loading quiz scores…" />}
          {!quizScoresLoading && quizScores.length === 0 && (
            <p className="groups-hint">No quiz submissions yet.</p>
          )}
          {!quizScoresLoading && quizScores.length > 0 && (
            <ul className="groups-quiz-score-list">
              {quizScores.map((row) => (
                <li key={row.student_email} className="groups-quiz-score-item">
                  <span>{row.student_name || row.student_email}</span>
                  <span>
                    {row.percent != null ? (
                      <>
                        {row.percent}% {row.passed ? '(Pass)' : '(Fail)'}
                      </>
                    ) : (
                      'Not taken'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" onClick={() => setQuizScoresFor(null)}>
            Close
          </Button>
        </section>
      )}
    </div>
  )
}

export default Groups
