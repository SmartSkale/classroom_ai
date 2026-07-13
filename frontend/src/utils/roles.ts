import type { User } from '../services/authService'
import { USER_ROLES } from './constants'

export function isStudent(user: User | null | undefined): boolean {
  return user?.role === USER_ROLES.student
}

export function isTeacherOrCreator(user: User | null | undefined): boolean {
  return user?.role === USER_ROLES.teacher || user?.role === USER_ROLES.courseCreator
}

export function canCreateContent(user: User | null | undefined): boolean {
  return isTeacherOrCreator(user) || user?.role === USER_ROLES.admin
}
