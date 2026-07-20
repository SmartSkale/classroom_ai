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

/** Role-aware library page subtitle. */
export function getLibrarySubtitle(user: User | null | undefined): string {
  if (isParent(user)) {
    return 'Revisit previous lessons or regenerate materials for your child.'
  }
  return 'Revisit previous lessons or regenerate materials for your class.'
}
