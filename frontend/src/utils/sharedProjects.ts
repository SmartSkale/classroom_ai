import type { GenerationJob } from '../context/generation-context'

const SHARED_PREFIX = 'classroomai.shared.'

/** Publish a project snapshot so students can open it via a shared link (browser-local). */
export function publishSharedProject(job: GenerationJob): void {
  localStorage.setItem(`${SHARED_PREFIX}${job.id}`, JSON.stringify(job))
}

export function loadSharedProject(projectId: string): GenerationJob | null {
  try {
    const raw = localStorage.getItem(`${SHARED_PREFIX}${projectId}`)
    if (!raw) return null
    return JSON.parse(raw) as GenerationJob
  } catch {
    return null
  }
}
