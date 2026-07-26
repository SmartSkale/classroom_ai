import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { OUTPUT_LANGUAGES, OUTPUT_TYPES, type OutputLanguageId, type OutputTypeId } from '../utils/constants'
import {
  clearLegacyProjectStorage,
  loadLegacyStoredJobs,
} from '../utils/projectStorage'
import { explanationService, type Explanation } from '../services/explanationService'
import { quizService } from '../services/quizService'
import { generationService } from '../services/generationService'
import { projectService } from '../services/projectService'
import { useAuth } from '../hooks/useAuth'
import { canCreateContent } from '../utils/roles'
import {
  GenerationContext,
  type GenerationJob,
  type GenerationStep,
  type StartGenerationInput,
  type StepStatus,
} from './generation-context'

const MIN_AUDIO_CHARS = 20
const MIN_VIDEO_CHARS = 120
const PERSIST_DEBOUNCE_MS = 600
const DEFAULT_OUTPUT_LANGUAGE: OutputLanguageId = 'english'

function outputLabel(id: OutputTypeId): string {
  return OUTPUT_TYPES.find((t) => t.id === id)?.label ?? id
}

function normalizeOutputLanguage(raw: unknown): OutputLanguageId {
  if (typeof raw === 'string' && OUTPUT_LANGUAGES.some((l) => l.id === raw)) {
    return raw as OutputLanguageId
  }
  return DEFAULT_OUTPUT_LANGUAGE
}

/** Ensure older persisted jobs without outputLanguage still work. */
function normalizeJob(job: GenerationJob): GenerationJob {
  return {
    ...job,
    outputLanguage: normalizeOutputLanguage(job.outputLanguage),
  }
}

function buildSteps(outputs: OutputTypeId[]): GenerationStep[] {
  return [
    { key: 'extract', label: 'Extracting content', status: 'pending' as StepStatus },
    ...outputs.map((o) => ({
      key: o,
      label: `Generating ${outputLabel(o)}`,
      status: 'pending' as StepStatus,
    })),
  ]
}

function recompute(steps: GenerationStep[]): { progress: number; done: boolean } {
  const settled = steps.filter((s) => s.status === 'done' || s.status === 'failed').length
  const progress = steps.length ? Math.round((settled / steps.length) * 100) : 100
  const done = steps.every((s) => s.status === 'done' || s.status === 'failed')
  return { progress, done }
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
    if (detail) return detail
  }
  if (err instanceof Error) return err.message
  return 'Generation failed.'
}

function isGenerationJob(value: unknown): value is GenerationJob {
  if (!value || typeof value !== 'object') return false
  const job = value as GenerationJob
  return (
    typeof job.id === 'string' &&
    typeof job.name === 'string' &&
    Array.isArray(job.outputs) &&
    Array.isArray(job.steps) &&
    typeof job.results === 'object' &&
    job.results !== null
  )
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, status: authStatus } = useAuth()
  const canPersistProjects = isAuthenticated && canCreateContent(user)
  const [jobs, setJobs] = useState<Record<string, GenerationJob>>({})
  const [hydrated, setHydrated] = useState(false)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const pendingPersist = useRef<Set<string>>(new Set())
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistInFlight = useRef(false)

  const flushPersist = useCallback(async () => {
    if (!canPersistProjects || persistInFlight.current) return
    const ids = [...pendingPersist.current]
    if (ids.length === 0) return

    pendingPersist.current.clear()
    persistInFlight.current = true
    try {
      await Promise.all(
        ids.map(async (id) => {
          const job = jobsRef.current[id]
          if (!job) return
          try {
            await projectService.upsertProject(job)
          } catch {
            // Re-queue failed writes so a later flush can retry.
            pendingPersist.current.add(id)
          }
        }),
      )
    } finally {
      persistInFlight.current = false
      if (pendingPersist.current.size > 0) {
        persistTimer.current = setTimeout(() => {
          void flushPersist()
        }, PERSIST_DEBOUNCE_MS)
      }
    }
  }, [canPersistProjects])

  const schedulePersist = useCallback(
    (id: string) => {
      if (!canPersistProjects) return
      pendingPersist.current.add(id)
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void flushPersist()
      }, PERSIST_DEBOUNCE_MS)
    },
    [flushPersist, canPersistProjects],
  )

  useEffect(() => {
    if (authStatus === 'loading') return

    if (!canPersistProjects) {
      // Students keep in-memory assignment snapshots; teachers clear on logout.
      if (!isAuthenticated) {
        setJobs({})
      }
      setHydrated(true)
      pendingPersist.current.clear()
      if (persistTimer.current) clearTimeout(persistTimer.current)
      return
    }

    let cancelled = false

    async function hydrate() {
      setHydrated(false)
      try {
        const projects = await projectService.listProjectJobs()
        if (cancelled) return

        const map: Record<string, GenerationJob> = {}
        for (const project of projects) {
          if (isGenerationJob(project.job)) {
            map[project.id] = normalizeJob({ ...project.job, id: project.id })
          }
        }

        // One-time migration from browser localStorage into the database.
        const legacy = loadLegacyStoredJobs()
        const legacyJobs = Object.values(legacy).filter(isGenerationJob)
        if (Object.keys(map).length === 0 && legacyJobs.length > 0) {
          await Promise.all(
            legacyJobs.map(async (job) => {
              const normalized = normalizeJob(job)
              try {
                await projectService.upsertProject(normalized)
                map[normalized.id] = normalized
              } catch {
                // Keep the job in memory even if migration fails for one entry.
                map[normalized.id] = normalized
              }
            }),
          )
          clearLegacyProjectStorage()
        } else if (legacyJobs.length > 0) {
          clearLegacyProjectStorage()
        }

        // Prefer in-memory jobs started while the API load was in flight.
        setJobs((prev) => ({ ...map, ...prev }))
      } catch {
        if (!cancelled) {
          const legacy = loadLegacyStoredJobs()
          const map: Record<string, GenerationJob> = {}
          for (const job of Object.values(legacy)) {
            if (isGenerationJob(job)) map[job.id] = normalizeJob(job)
          }
          setJobs((prev) => ({ ...map, ...prev }))
        }
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [authStatus, canPersistProjects, isAuthenticated])

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  const updateJob = useCallback(
    (id: string, mutate: (job: GenerationJob) => GenerationJob) => {
      setJobs((prev) => {
        const current = prev[id]
        if (!current) return prev
        const next = mutate(current)
        return { ...prev, [id]: next }
      })
      schedulePersist(id)
    },
    [schedulePersist],
  )

  const setStep = useCallback(
    (id: string, key: string, patch: Partial<GenerationStep>) => {
      updateJob(id, (job) => {
        const steps = job.steps.map((s) => (s.key === key ? { ...s, ...patch } : s))
        const { progress, done } = recompute(steps)
        return { ...job, steps, progress, done }
      })
    },
    [updateJob],
  )

  const setResult = useCallback(
    (id: string, patch: Partial<GenerationJob['results']>) => {
      updateJob(id, (job) => ({ ...job, results: { ...job.results, ...patch } }))
    },
    [updateJob],
  )

  const runOutput = useCallback(
    async (
      id: string,
      output: OutputTypeId,
      name: string,
      source: string,
      outputLanguage: OutputLanguageId,
      preExplain?: Explanation,
    ) => {
      setStep(id, output, { status: 'in_progress' })
      try {
        switch (output) {
          case 'explanation': {
            const explanation =
              preExplain ??
              (await explanationService.generateExplanation({
                chapterText: source,
                topicHint: name,
                outputLanguage,
              }))
            setResult(id, { explanation })
            break
          }
          case 'quiz': {
            const quiz = await quizService.generateQuiz(
              {
                topic: name,
                contextText: source || undefined,
                settings: { count: 10, types: ['mcq'], difficulty: 'medium' },
                outputLanguage,
              },
              { force: true },
            )
            setResult(id, { quiz })
            break
          }
          case 'slides': {
            const slides = await generationService.generateSlides(name, source, { outputLanguage })
            setResult(id, { slides })
            break
          }
          case 'flashcards': {
            const flashcards = await generationService.generateFlashcards(name, source, {
              outputLanguage,
            })
            setResult(id, { flashcards })
            break
          }
          case 'audio': {
            if (source.trim().length < MIN_AUDIO_CHARS) {
              throw new Error('Not enough source text to narrate audio.')
            }
            const audio = await generationService.generateAudio(source, { outputLanguage })
            setResult(id, { audio })
            break
          }
          case 'infographic': {
            const infographic = await generationService.generateInfographic(name, source, {
              outputLanguage,
            })
            setResult(id, { infographic })
            break
          }
          case 'illustration': {
            const illustration = await generationService.generateIllustration(name, source, {
              outputLanguage,
            })
            setResult(id, { illustration })
            break
          }
          case 'video': {
            if (source.trim().length < MIN_VIDEO_CHARS) {
              throw new Error('Need at least 120 characters of source text to generate a video.')
            }
            const video = await generationService.generateVideo(name, source, { outputLanguage })
            setResult(id, { video })
            break
          }
          default:
            throw new Error(`Unsupported output type: ${output}`)
        }
        setStep(id, output, { status: 'done' })
      } catch (err) {
        setStep(id, output, { status: 'failed', error: errorMessage(err) })
      }
    },
    [setResult, setStep],
  )

  const run = useCallback(
    async (id: string, input: StartGenerationInput, options?: { skipExtract?: boolean }) => {
      const name = input.name.trim()
      const files = input.files ?? []
      const outputLanguage = normalizeOutputLanguage(input.outputLanguage)

      if (!options?.skipExtract) {
        setStep(id, 'extract', { status: 'in_progress' })
      }

      let sourceText = input.text?.trim() ?? jobsRef.current[id]?.sourceText ?? ''
      let fileExplanation: Explanation | undefined

      if (!options?.skipExtract) {
        const canExtractFiles =
          files.length > 0 &&
          files.every(
            (f) => explanationService.isPdfFile(f) || explanationService.isImageFile(f),
          )

        if (canExtractFiles) {
          try {
            const { explanation, sourceText: extracted } =
              await explanationService.generateExplanationFromFile({
                files,
                topicHint: name,
                outputLanguage,
                documentType: input.documentType ?? 'auto',
              })
            fileExplanation = explanation
            if (extracted.trim()) sourceText = extracted.trim()
          } catch (err) {
            setStep(id, 'extract', { status: 'failed', error: errorMessage(err) })
          }
        }

        updateJob(id, (job) => ({ ...job, sourceText }))
        updateJob(id, (job) => {
          if (job.steps.find((s) => s.key === 'extract')?.status === 'failed') {
            const { progress, done } = recompute(job.steps)
            return { ...job, progress, done }
          }
          const steps = job.steps.map((s) =>
            s.key === 'extract' ? { ...s, status: 'done' as StepStatus } : s,
          )
          const { progress, done } = recompute(steps)
          return { ...job, steps, progress, done }
        })
      }

      await Promise.allSettled(
        input.outputs.map((output) =>
          runOutput(
            id,
            output,
            name,
            sourceText,
            outputLanguage,
            output === 'explanation' ? fileExplanation : undefined,
          ),
        ),
      )

      updateJob(id, (job) => {
        const { progress, done } = recompute(job.steps)
        return { ...job, progress, done }
      })
    },
    [runOutput, setStep, updateJob],
  )

  const startGeneration = useCallback(
    (input: StartGenerationInput): string => {
      const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const outputLanguage = normalizeOutputLanguage(input.outputLanguage)
      const job: GenerationJob = {
        id,
        name: input.name.trim(),
        outputs: input.outputs,
        outputLanguage,
        sourceText: input.text?.trim() ?? '',
        steps: buildSteps(input.outputs),
        results: {},
        progress: 0,
        done: false,
        error: null,
        createdAt: new Date().toISOString(),
      }
      setJobs((prev) => ({ ...prev, [id]: job }))
      schedulePersist(id)
      void run(id, { ...input, outputLanguage })
      return id
    },
    [run, schedulePersist],
  )

  const regenerateProject = useCallback(
    (id: string): string | null => {
      const existing = jobsRef.current[id]
      if (!existing) return null

      const outputLanguage = normalizeOutputLanguage(existing.outputLanguage)

      updateJob(id, () => ({
        ...existing,
        outputLanguage,
        steps: buildSteps(existing.outputs),
        results: {},
        progress: 0,
        done: false,
        error: null,
      }))

      void run(
        id,
        {
          name: existing.name,
          text: existing.sourceText,
          outputs: existing.outputs,
          outputLanguage,
        },
        { skipExtract: true },
      )
      return id
    },
    [run, updateJob],
  )

  const getJob = useCallback((id: string | undefined) => (id ? jobsRef.current[id] : undefined), [])

  const cacheResults = useCallback(
    (id: string, results: Partial<GenerationJob['results']>) => {
      if (jobsRef.current[id]) {
        setResult(id, results)
      }
    },
    [setResult],
  )

  const importSharedJob = useCallback((job: GenerationJob) => {
    if (!isGenerationJob(job)) return
    // Assignment / share-link snapshots stay in memory only (students are not project owners).
    setJobs((prev) => ({ ...prev, [job.id]: normalizeJob(job) }))
  }, [])

  const deleteProject = useCallback(
    async (id: string) => {
      pendingPersist.current.delete(id)
      await projectService.deleteProject(id)
      setJobs((prev) => {
        const { [id]: _removed, ...rest } = prev
        return rest
      })
    },
    [],
  )

  return (
    <GenerationContext.Provider
      value={{
        jobs,
        hydrated,
        startGeneration,
        regenerateProject,
        getJob,
        cacheResults,
        importSharedJob,
        deleteProject,
      }}
    >
      {children}
    </GenerationContext.Provider>
  )
}

export default GenerationProvider
