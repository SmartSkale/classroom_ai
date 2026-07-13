import JSZip from 'jszip'
import type { GenerationJob } from '../context/generation-context'
import type { QuizQuestion } from '../services/quizService'
import { generationService } from '../services/generationService'
import { OUTPUT_TYPES, type OutputTypeId } from './constants'
import { buildFlashcardsPdfBlob } from './flashcardPdf'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const VIDEO_COMPLETE = new Set(['completed', 'complete', 'succeeded', 'success', 'done'])
const VIDEO_POLL_MS = 3000
const VIDEO_POLL_MAX = 20

export interface BundleProgress {
  label: string
  current: number
  total: number
}

export interface BundleSkipped {
  output: string
  reason: string
}

export interface BundleResult {
  filename: string
  included: string[]
  skipped: BundleSkipped[]
}

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'project'
}

function outputLabel(id: OutputTypeId): string {
  return OUTPUT_TYPES.find((t) => t.id === id)?.label ?? id
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('Invalid image data')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function formatQuizText(projectName: string, questions: QuizQuestion[]): string {
  const lines: string[] = [`${projectName} — Quiz`, '']
  questions.forEach((q) => {
    lines.push(`Q${q.number}. ${q.prompt}`)
    if (q.options?.length) {
      q.options.forEach((opt, i) => lines.push(`   (${LETTERS[i]}) ${opt}`))
      if (q.answerIndex != null && q.options[q.answerIndex]) {
        lines.push(`   Answer: (${LETTERS[q.answerIndex]}) ${q.options[q.answerIndex]}`)
      }
    } else if (q.answer) {
      lines.push(`   Answer: ${q.answer}`)
    }
    if (q.correctExplanation) lines.push(`   Note: ${q.correctExplanation}`)
    lines.push('')
  })
  return lines.join('\n')
}

async function waitForVideo(videoId: string): Promise<boolean> {
  for (let i = 0; i < VIDEO_POLL_MAX; i += 1) {
    const status = await generationService.getVideoJobStatus(videoId)
    if (VIDEO_COMPLETE.has(status.status.toLowerCase())) return true
    if (['failed', 'error', 'cancelled'].includes(status.status.toLowerCase())) return false
    await new Promise((r) => setTimeout(r, VIDEO_POLL_MS))
  }
  return false
}

type ZipEntry = { path: string; data: Blob | Uint8Array | string }

export async function buildProjectBundle(
  job: GenerationJob,
  onProgress?: (progress: BundleProgress) => void,
): Promise<{ zip: JSZip; result: BundleResult }> {
  const folderName = slugify(job.name)
  const zip = new JSZip()
  const folder = zip.folder(folderName)
  if (!folder) throw new Error('Could not create ZIP folder')

  const included: string[] = []
  const skipped: BundleSkipped[] = []
  const tasks: Array<{ output: OutputTypeId; run: () => Promise<ZipEntry | null> }> = []

  const queue = (output: OutputTypeId, run: () => Promise<ZipEntry | null>) => {
    if (job.outputs.includes(output)) tasks.push({ output, run })
  }

  queue('explanation', async () => {
    const explanation = job.results.explanation
    if (!explanation?.markdown.trim()) return null
    return {
      path: 'explanation.md',
      data: explanation.markdown,
    }
  })

  queue('quiz', async () => {
    const quiz = job.results.quiz
    if (!quiz?.length) return null
    return {
      path: 'quiz.txt',
      data: formatQuizText(job.name, quiz),
    }
  })

  queue('slides', async () => {
    const deck = job.results.slides
    if (!deck?.deckId) return null
    const blob = await generationService.downloadSlideDeck(deck.deckId)
    return {
      path: deck.filename || 'slides.pptx',
      data: blob,
    }
  })

  queue('flashcards', async () => {
    const deck = job.results.flashcards
    if (!deck?.cards?.length) return null
    const order = deck.cards.map((_, i) => i)
    return {
      path: `${slugify(job.name)}-flashcards.pdf`,
      data: buildFlashcardsPdfBlob(deck.topic || job.name, deck.cards, order),
    }
  })

  queue('audio', async () => {
    const audio = job.results.audio
    if (!audio?.audioId) return null
    const blob = await generationService.downloadAudio(audio.audioId)
    return {
      path: audio.filename || `${slugify(job.name)}.mp3`,
      data: blob,
    }
  })

  queue('infographic', async () => {
    const image = job.results.infographic
    if (!image?.dataUrl) return null
    return {
      path: `${slugify(job.name)}-infographic.png`,
      data: dataUrlToBytes(image.dataUrl),
    }
  })

  queue('illustration', async () => {
    const image = job.results.illustration
    if (!image?.dataUrl) return null
    return {
      path: `${slugify(job.name)}-illustration.png`,
      data: dataUrlToBytes(image.dataUrl),
    }
  })

  queue('video', async () => {
    const video = job.results.video
    if (!video?.videoId) return null
    const ready = VIDEO_COMPLETE.has(video.status.toLowerCase()) || (await waitForVideo(video.videoId))
    if (!ready) return null
    const blob = await generationService.downloadVideo(video.videoId)
    return {
      path: `${slugify(job.name)}.mp4`,
      data: blob,
    }
  })

  const total = tasks.length
  let current = 0

  for (const task of tasks) {
    current += 1
    onProgress?.({
      label: `Preparing ${outputLabel(task.output)}…`,
      current,
      total,
    })

    const step = job.steps.find((s) => s.key === task.output)
    if (step?.status === 'failed') {
      skipped.push({
        output: outputLabel(task.output),
        reason: step.error ?? 'Generation failed',
      })
      continue
    }

    try {
      const entry = await task.run()
      if (!entry) {
        skipped.push({
          output: outputLabel(task.output),
          reason:
            step?.status === 'pending' || step?.status === 'in_progress'
              ? 'Still generating — try again shortly'
              : 'No content available',
        })
        continue
      }
      folder.file(entry.path, entry.data)
      included.push(entry.path)
    } catch (err) {
      skipped.push({
        output: outputLabel(task.output),
        reason: err instanceof Error ? err.message : 'Download failed',
      })
    }
  }

  onProgress?.({ label: 'Creating ZIP…', current: total, total })

  const readmeLines = [
    `${job.name}`,
    `Generated by ClassroomAI`,
    '',
    'Included files:',
    ...(included.length ? included.map((f) => `  • ${f}`) : ['  (none)']),
    '',
  ]
  if (skipped.length) {
    readmeLines.push('Skipped:', ...skipped.map((s) => `  • ${s.output}: ${s.reason}`), '')
  }
  folder.file('README.txt', readmeLines.join('\n'))
  included.unshift('README.txt')

  const result: BundleResult = {
    filename: `${folderName}-materials.zip`,
    included,
    skipped,
  }

  return { zip, result }
}

export async function downloadProjectBundle(
  job: GenerationJob,
  onProgress?: (progress: BundleProgress) => void,
): Promise<BundleResult> {
  const { zip, result } = await buildProjectBundle(job, onProgress)
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return result
}

export function countReadyOutputs(job: GenerationJob): number {
  return job.outputs.filter((output) => {
    const step = job.steps.find((s) => s.key === output)
    return step?.status === 'done' && hasResult(job, output)
  }).length
}

function hasResult(job: GenerationJob, output: OutputTypeId): boolean {
  const { results } = job
  switch (output) {
    case 'explanation':
      return Boolean(results.explanation?.markdown.trim())
    case 'quiz':
      return Boolean(results.quiz?.length)
    case 'slides':
      return Boolean(results.slides?.deckId)
    case 'flashcards':
      return Boolean(results.flashcards?.cards?.length)
    case 'audio':
      return Boolean(results.audio?.audioId)
    case 'infographic':
      return Boolean(results.infographic?.dataUrl)
    case 'illustration':
      return Boolean(results.illustration?.dataUrl)
    case 'video':
      return Boolean(results.video?.videoId)
    default:
      return false
  }
}
