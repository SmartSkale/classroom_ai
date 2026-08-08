import api from './api'
import { API_BASE_URL, SLIDE_COUNT_MAX, SLIDE_COUNT_MIN, type OutputLanguageId } from '../utils/constants'

/**
 * Backend wiring for the remaining output types (everything except explanation
 * and quiz, which have their own dedicated services). Each function calls the
 * real backend endpoint and returns a small, UI-friendly result. All requests
 * default to the `openai` stack and English when language is omitted.
 */

const STACK = 'openai'
const DEFAULT_OUTPUT_LANGUAGE: OutputLanguageId = 'english'

/** Clamp + trim source material to the backend `context_text` limit. */
function asContext(text?: string): string | null {
  const trimmed = text?.trim()
  return trimmed ? trimmed.slice(0, 30000) : null
}

function asTopic(topic: string): string {
  return (topic || 'Untitled lesson').slice(0, 200)
}

/* ------------------------------- Slides --------------------------------- */

export interface SlideItem {
  title: string
  bullets: string[]
  speakerNotes?: string | null
  imageQuery?: string | null
}

export interface SlideDeck {
  deckId: string
  deckTitle: string
  filename: string
  downloadUrl: string
  slides: SlideItem[]
}

interface BackendSlideItem {
  title: string
  bullets: string[]
  speaker_notes?: string | null
  image_query?: string | null
}

interface BackendSlideDeck {
  deck_id: string
  deck_title: string
  filename: string
  slides: BackendSlideItem[]
}

export interface SlidesOptions {
  /** Requested number of content slides (clamped to the backend's 4–20 range). */
  slideCount?: number
  outputLanguage?: OutputLanguageId
}

function clampSlideCount(n: number | undefined): number {
  const value = Math.round(n ?? 10)
  return Math.min(SLIDE_COUNT_MAX, Math.max(SLIDE_COUNT_MIN, Number.isFinite(value) ? value : 10))
}

/** Fetch the generated PPTX bytes (auth-protected endpoint) as a Blob. */
async function downloadSlideDeck(deckId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/slides/${deckId}/file`, { responseType: 'blob' })
  return data
}

async function generateSlides(
  topic: string,
  contextText?: string,
  opts: SlidesOptions = {},
): Promise<SlideDeck> {
  const { data } = await api.post<BackendSlideDeck>('/slides/generate', {
    topic: asTopic(topic),
    context_text: asContext(contextText),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    stack: STACK,
    slide_count: clampSlideCount(opts.slideCount),
  })
  return {
    deckId: data.deck_id,
    deckTitle: data.deck_title,
    filename: data.filename,
    downloadUrl: `${API_BASE_URL}/slides/${data.deck_id}/file`,
    slides: data.slides.map((s) => ({
      title: s.title,
      bullets: s.bullets ?? [],
      speakerNotes: s.speaker_notes ?? null,
      imageQuery: s.image_query ?? null,
    })),
  }
}

/* ----------------------------- Flashcards ------------------------------- */

export interface Flashcard {
  front: string
  back: string
}

export interface FlashcardDeck {
  topic: string
  cards: Flashcard[]
}

interface BackendFlashcardsResponse {
  topic: string
  output_language_used: string
  cards: Flashcard[]
}

export interface FlashcardsOptions {
  /** Requested number of cards (clamped to the backend's 4–40 range). */
  cardCount?: number
  outputLanguage?: OutputLanguageId
}

function clampCardCount(n: number | undefined): number {
  const value = Math.round(n ?? 12)
  return Math.min(40, Math.max(4, Number.isFinite(value) ? value : 12))
}

async function generateFlashcards(
  topic: string,
  contextText?: string,
  opts: FlashcardsOptions = {},
): Promise<FlashcardDeck> {
  const { data } = await api.post<BackendFlashcardsResponse>('/flashcards/generate', {
    topic: asTopic(topic),
    context_text: asContext(contextText),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    stack: STACK,
    card_count: clampCardCount(opts.cardCount),
  })
  return { topic: data.topic, cards: data.cards ?? [] }
}

/* -------------------------------- Audio --------------------------------- */

export interface AudioResult {
  audioId: string
  filename: string
  mimeType: string
  downloadUrl: string
  engine?: string
  truncated?: boolean
  translationApplied?: boolean
  /** Echo of the settings used, so a screen can restore its selectors. */
  voice?: string
  outputLanguage?: string
}

export interface AudioOptions {
  outputLanguage?: string
  /** One of the OpenAI TTS voices: alloy | echo | fable | onyx | nova | shimmer. */
  voice?: string
}

interface BackendSpeechResponse {
  audio_id: string
  filename: string
  mime_type: string
  engine?: string
  truncated?: boolean
  translation_applied?: boolean
}

async function generateAudio(contextText: string, opts: AudioOptions = {}): Promise<AudioResult> {
  const { data } = await api.post<BackendSpeechResponse>('/audio/speech', {
    context_text: contextText.slice(0, 120000),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    stack: STACK,
    openai_voice: opts.voice ?? 'nova',
  })
  return {
    audioId: data.audio_id,
    filename: data.filename,
    mimeType: data.mime_type,
    downloadUrl: `${API_BASE_URL}/audio/${data.audio_id}/file`,
    engine: data.engine,
    truncated: data.truncated,
    translationApplied: data.translation_applied,
    voice: opts.voice ?? 'nova',
    outputLanguage: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
  }
}

/** Fetch the generated MP3 bytes (auth-protected endpoint) as a Blob. */
async function downloadAudio(audioId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/audio/${audioId}/file`, { responseType: 'blob' })
  return data
}

/* ------------------------------- Images --------------------------------- */

export interface ImageResult {
  dataUrl: string
  promptUsed?: string
}

interface BackendImageResponse {
  image_base64: string
  mime_type: string
  image_prompt_used?: string
}

export interface InfographicOptions {
  /** Prompt phrase describing the layout (timeline, comparison, …). */
  layoutPrompt?: string
  /** Prompt phrase describing the color palette. */
  colorPrompt?: string
  outputLanguage?: OutputLanguageId
}

function buildInfographicStyle(opts: InfographicOptions): string | undefined {
  const parts = [opts.layoutPrompt, opts.colorPrompt].filter(Boolean)
  if (parts.length === 0) return undefined
  return `flat vector educational infographic, ${parts.join(', ')}, bold icons, clean arrows, high contrast, short readable labels`
}

async function generateInfographic(
  topic: string,
  contextText?: string,
  opts: InfographicOptions = {},
): Promise<ImageResult> {
  const style = buildInfographicStyle(opts)
  const { data } = await api.post<BackendImageResponse>('/infographic/generate', {
    topic: asTopic(topic),
    context_text: asContext(contextText),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    stack: STACK,
    ...(style ? { style } : {}),
  })
  return {
    dataUrl: `data:${data.mime_type};base64,${data.image_base64}`,
    promptUsed: data.image_prompt_used,
  }
}

export interface IllustrationOptions {
  outputLanguage?: OutputLanguageId
}

async function generateIllustration(
  topic: string,
  contextText?: string,
  opts: IllustrationOptions = {},
): Promise<ImageResult> {
  // Send topic + context separately so the backend can LLM-rewrite a visual scene
  // prompt instead of dumping raw lesson/OCR text into the image model.
  const { data } = await api.post<BackendImageResponse>('/illustration', {
    topic: asTopic(topic),
    context_text: asContext(contextText),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    stack: STACK,
    source: 'ai',
  })
  return {
    dataUrl: `data:${data.mime_type};base64,${data.image_base64}`,
    promptUsed: data.image_prompt_used,
  }
}

/* -------------------------------- Video --------------------------------- */

export interface VideoResult {
  videoId: string
  status: string
  pollUrl: string
  fileUrl: string
}

interface BackendVideoJob {
  id: string
  status: string
}

export interface VideoOptions {
  outputLanguage?: OutputLanguageId
}

/**
 * Kick off a narrated lesson-overview video from the source text. Video
 * rendering is asynchronous on the backend, so this returns the created job
 * (with poll/file URLs) rather than blocking until the MP4 is ready.
 */
async function generateVideo(
  topic: string,
  contextText: string,
  opts: VideoOptions = {},
): Promise<VideoResult> {
  const { data } = await api.post<BackendVideoJob>('/video/jobs', {
    prompt: asTopic(topic),
    stack: 'lesson_overview',
    lesson_source_text: contextText.slice(0, 32000),
    output_language: opts.outputLanguage ?? DEFAULT_OUTPUT_LANGUAGE,
    lesson_llm_stack: STACK,
  })
  return {
    videoId: data.id,
    status: data.status,
    pollUrl: `${API_BASE_URL}/video/jobs/${data.id}`,
    fileUrl: `${API_BASE_URL}/video/jobs/${data.id}/file`,
  }
}

interface BackendVideoStatus {
  id: string
  status: string
  progress?: number | null
  error?: { code?: string; message?: string } | null
}

/** Poll video job status until complete or failed. */
async function getVideoJobStatus(videoId: string): Promise<BackendVideoStatus> {
  const { data } = await api.get<BackendVideoStatus>(`/video/jobs/${videoId}`)
  return data
}

/** Fetch the rendered MP4 as a Blob (auth-protected). */
async function downloadVideo(videoId: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/video/jobs/${videoId}/file`, { responseType: 'blob' })
  return data
}

export const generationService = {
  generateSlides,
  downloadSlideDeck,
  generateFlashcards,
  generateAudio,
  downloadAudio,
  generateInfographic,
  generateIllustration,
  generateVideo,
  getVideoJobStatus,
  downloadVideo,
}
export default generationService
