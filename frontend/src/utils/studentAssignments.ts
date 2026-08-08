import type { OutputTypeId } from './constants'

const ASSIGNMENTS_KEY = 'classroomai.student.assignments'

export interface StudentAssignment {
  projectId: string
  name: string
  outputs: OutputTypeId[]
  assignedAt: string
  lastQuizPercent?: number
  lastQuizPassed?: boolean
}

function readAll(): StudentAssignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY)
    return raw ? (JSON.parse(raw) as StudentAssignment[]) : []
  } catch {
    return []
  }
}

function writeAll(assignments: StudentAssignment[]) {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments))
}

export function listStudentAssignments(): StudentAssignment[] {
  return readAll().sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  )
}

export function addStudentAssignment(assignment: Omit<StudentAssignment, 'assignedAt'>): void {
  const existing = readAll()
  const entry: StudentAssignment = {
    ...assignment,
    assignedAt: new Date().toISOString(),
  }
  const next = [entry, ...existing.filter((a) => a.projectId !== assignment.projectId)]
  writeAll(next)
}

export function updateQuizProgress(
  projectId: string,
  percent: number,
  passed: boolean,
): void {
  const next = readAll().map((a) =>
    a.projectId === projectId ? { ...a, lastQuizPercent: percent, lastQuizPassed: passed } : a,
  )
  writeAll(next)
}
