import type { GenerationJob } from '../context/generation-context'
import type { OutputTypeId } from './constants'

const PROJECTS_KEY = 'classroomai.projects'
const JOBS_KEY = 'classroomai.jobs'

export type ProjectType =
  | 'explanation'
  | 'quiz'
  | 'slides'
  | 'flashcards'
  | 'audio'
  | 'video'
  | 'infographic'
  | 'illustration'

export interface StoredProject {
  id: string
  name: string
  type: ProjectType
  outputs: OutputTypeId[]
  createdAt: string
  updatedAt: string
  done: boolean
}

const TYPE_PRIORITY: OutputTypeId[] = [
  'explanation',
  'quiz',
  'slides',
  'flashcards',
  'audio',
  'video',
  'infographic',
  'illustration',
]

export function primaryOutputType(outputs: OutputTypeId[]): ProjectType {
  for (const id of TYPE_PRIORITY) {
    if (outputs.includes(id)) return id as ProjectType
  }
  return 'explanation'
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Legacy browser storage — used only to migrate existing data into the API. */
export function loadLegacyStoredJobs(): Record<string, GenerationJob> {
  return readJson<Record<string, GenerationJob>>(JOBS_KEY, {})
}

export function loadLegacyStoredProjects(): StoredProject[] {
  return readJson<StoredProject[]>(PROJECTS_KEY, [])
}

export function clearLegacyProjectStorage(): void {
  localStorage.removeItem(PROJECTS_KEY)
  localStorage.removeItem(JOBS_KEY)
}
