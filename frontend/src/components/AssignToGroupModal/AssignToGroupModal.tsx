import { useCallback, useEffect, useState } from 'react'
import { Button } from '../Button'
import { Loader } from '../Loader'
import { Modal } from '../Modal'
import type { GenerationJob } from '../../context/generation-context'
import { groupService, type TeacherGroup } from '../../services/groupService'
import type { OutputTypeId } from '../../utils/constants'
import './AssignToGroupModal.css'

interface AssignToGroupModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  outputs: OutputTypeId[]
  job: GenerationJob | undefined
  onAssigned?: () => void
}

export function AssignToGroupModal({
  open,
  onClose,
  projectId,
  projectName,
  outputs,
  job,
  onAssigned,
}: AssignToGroupModalProps) {
  const [groups, setGroups] = useState<TeacherGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [assigningId, setAssigningId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await groupService.listGroups({ projectId })
      setGroups(data)
    } catch {
      setError('Could not load your groups.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!open) return
    setSuccess(null)
    void loadGroups()
  }, [open, loadGroups])

  async function handleAssign(groupId: number, groupName: string) {
    if (!job) {
      setError('Lesson content is not loaded. Open the project first, then try again.')
      return
    }
    setAssigningId(groupId)
    setError(null)
    setSuccess(null)
    try {
      await groupService.assignToGroup(groupId, {
        project_id: projectId,
        title: projectName,
        outputs,
        content_snapshot: job,
      })
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupId ? { ...group, project_assigned: true } : group,
        ),
      )
      setSuccess(`Assigned to “${groupName}”. Students in that group can access it now.`)
      onAssigned?.()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 409) {
        setGroups((prev) =>
          prev.map((group) =>
            group.id === groupId ? { ...group, project_assigned: true } : group,
          ),
        )
        setError(`“${groupName}” already has this project assigned.`)
      } else {
        setError('Could not assign content to this group.')
      }
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign to group"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <p className="assign-modal-intro">
        Choose a class group. Every student email in that group will see{' '}
        <strong>{projectName}</strong> on their dashboard.
      </p>

      {loading && <Loader label="Loading groups…" />}

      {error && (
        <p className="assign-modal-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="assign-modal-success" role="status">
          {success}
        </p>
      )}

      {!loading && !error && groups.length === 0 && (
        <p className="assign-modal-empty">
          You have no groups yet. Create one from the Groups page, add student emails, then assign
          content here.
        </p>
      )}

      {!loading && groups.length > 0 && (
        <ul className="assign-modal-list">
          {groups.map((group) => {
            const alreadyAssigned = Boolean(group.project_assigned)
            return (
              <li
                key={group.id}
                className={`assign-modal-item${alreadyAssigned ? ' assign-modal-item-assigned' : ''}`}
              >
                <div>
                  <span className="assign-modal-name">{group.name}</span>
                  <span className="assign-modal-meta">
                    {group.member_count} student{group.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                {alreadyAssigned ? (
                  <span className="assign-modal-assigned-badge" role="status">
                    Already assigned
                  </span>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={assigningId === group.id}
                    onClick={() => void handleAssign(group.id, group.name)}
                  >
                    {assigningId === group.id ? 'Assigning…' : 'Assign'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

export default AssignToGroupModal
