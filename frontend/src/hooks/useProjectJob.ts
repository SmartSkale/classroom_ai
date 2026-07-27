import { useEffect, useState } from 'react'
import { useGeneration, type GenerationJob } from '../context/generation-context'

interface UseProjectJobResult {
  job: GenerationJob | undefined
  loading: boolean
  loadError: string | null
}

/** Resolve a project job from context, fetching from the API when missing. */
export function useProjectJob(projectId: string): UseProjectJobResult {
  const { jobs, hydrated, loadProject } = useGeneration()
  const job = projectId ? jobs[projectId] : undefined
  const [loading, setLoading] = useState(Boolean(projectId) && !job)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !hydrated || job) {
      if (job) {
        setLoading(false)
        setLoadError(null)
      }
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void loadProject(projectId)
      .then((loaded) => {
        if (cancelled) return
        setLoading(false)
        if (!loaded) setLoadError('Could not load this project.')
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setLoadError('Could not load this project.')
      })

    return () => {
      cancelled = true
    }
  }, [projectId, hydrated, job, loadProject])

  return {
    job,
    loading: !hydrated || loading,
    loadError,
  }
}
