import api from './api'
import type { OutputLanguageId, PdfDocumentTypeId } from '../utils/constants'

/** @deprecated Prefer OutputLanguageId from utils/constants — kept for existing imports. */
export type OutputLanguage = OutputLanguageId

export interface VisualBrief {
  title: string
  description: string
  kind: string
  suggested_format?: string
  src?: string | null
  mermaid_diagram?: string | null
}

/** Shape returned by POST /api/v1/explain/text (subset we render). */
interface ExplainResponse {
  explanation_markdown: string
  simple_examples?: string[]
  visual_briefs?: VisualBrief[]
  suggested_followup_topics?: string[]
  mermaid_diagram?: string | null
  diagram_caption?: string | null
  output_language_used?: OutputLanguage | null
  /** Raw extracted text echoed by the backend (PDF uploads) for quiz/slides context. */
  source_text_used_for_context?: string | null
}

export interface Explanation {
  markdown: string
  examples: string[]
  followups: string[]
  visualBriefs: VisualBrief[]
  mermaid: string | null
  diagramCaption: string | null
  languageUsed: OutputLanguage | null
}

export interface GenerateExplanationParams {
  chapterText: string
  topicHint?: string
  /** "openai" | "opensource" — defaults to openai. */
  stack?: string
  outputLanguage?: OutputLanguage
}

export interface GenerateExplanationFromFileParams {
  files: File[]
  topicHint?: string
  stack?: string
  outputLanguage?: OutputLanguage
  /** PDF only: printed (default path) or handwritten (Tesseract). Omit for auto on backend. */
  documentType?: PdfDocumentTypeId | 'auto'
}

/**
 * An explanation plus the raw source text the backend extracted from the upload.
 * The source text is reused as grounding context for the other outputs (quiz,
 * slides, flashcards, …) so they describe the same material.
 */
export interface ExplanationWithSource {
  explanation: Explanation
  sourceText: string
}

function toExplanation(data: ExplainResponse): Explanation {
  return {
    markdown: data.explanation_markdown,
    examples: data.simple_examples ?? [],
    followups: data.suggested_followup_topics ?? [],
    visualBriefs: data.visual_briefs ?? [],
    mermaid: data.mermaid_diagram ?? null,
    diagramCaption: data.diagram_caption ?? null,
    languageUsed: data.output_language_used ?? null,
  }
}

/**
 * Generate a lesson explanation from chapter text via the backend.
 * Endpoint: POST /api/v1/explain/text (requires auth). `stack` is a query param.
 */
async function generateExplanation(params: GenerateExplanationParams): Promise<Explanation> {
  const { chapterText, topicHint, stack = 'openai', outputLanguage = 'english' } = params

  const { data } = await api.post<ExplainResponse>(
    '/explain/text',
    {
      chapter_text: chapterText,
      output_language: outputLanguage,
      topic_hint: topicHint?.trim() || null,
    },
    { params: { stack } },
  )

  return toExplanation(data)
}

function isImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || file.type.startsWith('image/')
}

function isPdfFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ext === 'pdf' || file.type === 'application/pdf'
}

function appendExplainFormFields(
  form: FormData,
  topicHint: string | undefined,
  stack: string,
  outputLanguage: OutputLanguage,
): void {
  form.append('output_language', outputLanguage)
  if (topicHint?.trim()) form.append('topic_hint', topicHint.trim())
  form.append('stack', stack)
}

/**
 * Generate an explanation directly from uploaded files (PDF or image(s)) and
 * return both the explanation and the extracted source text.
 *
 * - PDFs use POST /api/v1/explain/pdf (server extracts text + OCR and echoes it
 *   back in `source_text_used_for_context`).
 * - A single image uses POST /api/v1/explain/image (vision model).
 * - Multiple images use POST /api/v1/explain/images (vision model).
 *   There is no extracted plain text for images, so the generated markdown
 *   doubles as the grounding context.
 */
async function generateExplanationFromFile(
  params: GenerateExplanationFromFileParams,
): Promise<ExplanationWithSource> {
  const {
    files,
    topicHint,
    stack = 'openai',
    outputLanguage = 'english',
    documentType = 'auto',
  } = params

  if (files.length === 0) {
    throw new Error('No files provided for extraction.')
  }

  const hasPdf = files.some((f) => isPdfFile(f))
  const hasImage = files.some((f) => isImageFile(f))

  if (hasPdf && hasImage) {
    throw new Error('Upload either one PDF or multiple images, not both.')
  }
  if (hasPdf && files.length > 1) {
    throw new Error('Only one PDF can be uploaded at a time.')
  }
  if (!hasPdf && !hasImage) {
    throw new Error('Unsupported file type for extraction. Use a PDF or image.')
  }

  const form = new FormData()
  appendExplainFormFields(form, topicHint, stack, outputLanguage)

  let endpoint: string
  if (hasPdf) {
    form.append('file', files[0])
    form.append('document_type', documentType)
    endpoint = '/explain/pdf'
  } else if (files.length === 1) {
    form.append('file', files[0])
    endpoint = '/explain/image'
  } else {
    for (const file of files) {
      form.append('files', file)
    }
    endpoint = '/explain/images'
  }

  const { data } = await api.post<ExplainResponse>(endpoint, form)

  const explanation = toExplanation(data)
  const sourceText = data.source_text_used_for_context?.trim() || explanation.markdown
  return { explanation, sourceText }
}

async function detectPdfType(
  file: File,
): Promise<{ looks_printed: boolean; looks_handwritten: boolean }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ looks_printed: boolean; looks_handwritten: boolean }>(
    '/explain/pdf/detect',
    form,
  )
  return data
}

export const explanationService = {
  generateExplanation,
  generateExplanationFromFile,
  detectPdfType,
  isImageFile,
  isPdfFile,
}
export default explanationService
