import api from './api'
import type { GenerationJob } from '../context/generation-context'
import type { OutputTypeId } from '../utils/constants'

export interface TeacherGroup {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
  member_count: number
  assignment_count: number
}

export interface GroupMember {
  id: number
  email: string
  user_id: number | null
  status: 'pending' | 'active'
  invited_at: string
}

export interface GroupDetail extends TeacherGroup {
  members: GroupMember[]
}

export interface GroupAssignment {
  id: number
  group_id: number
  project_id: string
  title: string
  outputs: string[]
  assigned_at: string
}

export interface StudentGroupAssignment {
  assignment_id: number
  group_id: number
  group_name: string
  project_id: string
  title: string
  outputs: OutputTypeId[]
  assigned_at: string
  content_snapshot: GenerationJob | null
  last_quiz_percent: number | null
  last_quiz_passed: boolean | null
}

async function listGroups(): Promise<TeacherGroup[]> {
  const { data } = await api.get<TeacherGroup[]>('/groups')
  return data
}

async function createGroup(input: { name: string; description?: string }): Promise<TeacherGroup> {
  const { data } = await api.post<TeacherGroup>('/groups', input)
  return data
}

async function getGroup(groupId: number): Promise<GroupDetail> {
  const { data } = await api.get<GroupDetail>(`/groups/${groupId}`)
  return data
}

async function updateGroup(
  groupId: number,
  input: { name?: string; description?: string },
): Promise<TeacherGroup> {
  const { data } = await api.patch<TeacherGroup>(`/groups/${groupId}`, input)
  return data
}

async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(`/groups/${groupId}`)
}

async function addMembers(groupId: number, emails: string[]): Promise<GroupMember[]> {
  const { data } = await api.post<GroupMember[]>(`/groups/${groupId}/members`, { emails })
  return data
}

async function removeMember(groupId: number, memberId: number): Promise<void> {
  await api.delete(`/groups/${groupId}/members/${memberId}`)
}

async function listGroupAssignments(groupId: number): Promise<GroupAssignment[]> {
  const { data } = await api.get<GroupAssignment[]>(`/groups/${groupId}/assignments`)
  return data
}

async function assignToGroup(
  groupId: number,
  input: {
    project_id: string
    title: string
    outputs: OutputTypeId[]
    content_snapshot: GenerationJob | null
  },
): Promise<GroupAssignment> {
  const { data } = await api.post<GroupAssignment>(`/groups/${groupId}/assignments`, input)
  return data
}

async function removeAssignment(groupId: number, assignmentId: number): Promise<void> {
  await api.delete(`/groups/${groupId}/assignments/${assignmentId}`)
}

async function listMyAssignments(): Promise<StudentGroupAssignment[]> {
  const { data } = await api.get<StudentGroupAssignment[]>('/assignments')
  return data
}

export const groupService = {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember,
  listGroupAssignments,
  assignToGroup,
  removeAssignment,
  listMyAssignments,
}

export default groupService
