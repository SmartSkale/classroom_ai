import type { User } from '../services/authService'
import { USER_ROLES } from './constants'

export function isStudent(user: User | null | undefined): boolean {
  return user?.role === USER_ROLES.student
}

export function isTeacherOrCreator(user: User | null | undefined): boolean {
  return user?.role === USER_ROLES.teacher || user?.role === USER_ROLES.courseCreator
}

export function isParent(user: User | null | undefined): boolean {
  return user?.role === USER_ROLES.parent
}

/** Upload, Project Library, and generation persistence (includes parents). */
export function canCreateContent(user: User | null | undefined): boolean {
  return (
    isTeacherOrCreator(user) ||
    isParent(user) ||
    user?.role === USER_ROLES.admin
  )
}

/** Class groups, assignments, and group quiz scoreboards (excludes parents). */
export function canManageGroups(user: User | null | undefined): boolean {
  return isTeacherOrCreator(user) || user?.role === USER_ROLES.admin
}

/** Role-aware dashboard subtitle for content creators. */
export function getDashboardSubtitle(user: User | null | undefined): string {
  if (isParent(user)) {
    return 'Upload chapters, generate lessons, and download materials for home learning.'
  }
  return 'Upload a chapter, generate materials, and download assets for your class.'
}

export function getWorkspaceTitle(user: User | null | undefined): string {
  switch (user?.role) {
    case USER_ROLES.student:
      return 'Learner Workspace'
    case USER_ROLES.teacher:
      return 'Teacher Workspace'
    case USER_ROLES.parent:
      return 'Parent Workspace'
    case USER_ROLES.courseCreator:
      return 'Creator Workspace'
    case USER_ROLES.admin:
      return 'Admin Workspace'
    default:
      return 'Workspace'
  }
}

export function getRoleLabel(user: User | null | undefined): string {
  switch (user?.role) {
    case USER_ROLES.student:
      return 'LEARNER'
    case USER_ROLES.teacher:
      return 'TEACHER'
    case USER_ROLES.parent:
      return 'PARENT'
    case USER_ROLES.courseCreator:
      return 'CREATOR'
    case USER_ROLES.admin:
      return 'ADMIN'
    default:
      return 'USER'
  }
}

export function getUserFirstName(user: User | null | undefined): string {
  return user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
}

export function getUserDisplayName(user: User | null | undefined): string {
  return user?.full_name?.trim() || user?.email?.split('@')[0] || 'User'
}

/** Role-aware library page subtitle. */
export function getLibrarySubtitle(user: User | null | undefined): string {
  if (isParent(user)) {
    return 'Revisit previous lessons or regenerate materials for your child.'
  }
  return 'Revisit previous lessons or regenerate materials for your class.'
}
