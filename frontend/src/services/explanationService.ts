import api from './api'
import type { OutputLanguageId } from '../utils/constants'

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
  /** True when chapterText came from PDF extraction. */
  fromPdf?: boolean
}

export interface GenerateExplanationFromFileParams {
  files: File[]
  topicHint?: string
  stack?: string
  outputLanguage?: OutputLanguage
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

/** Thrown when explanation generation fails but PDF text was extracted. */
export class ExplanationGenerationError extends Error {
  sourceText: string

  constructor(message: string, sourceText: string) {
    super(message)
    this.name = 'ExplanationGenerationError'
    this.sourceText = sourceText
  }
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
  const {
    chapterText,
    topicHint,
    stack = 'openai',
    outputLanguage = 'english',
    fromPdf = false,
  } = params

  const { data } = await api.post<ExplainResponse>(
    '/explain/text',
    {
      chapter_text: chapterText,
      output_language: outputLanguage,
      topic_hint: topicHint?.trim() || null,
      from_pdf: fromPdf,
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
 * - PDFs extract text via POST /api/v1/explain/pdf-extract, then explain via
 *   POST /api/v1/explain/text. Scanned PDFs fall back to POST /api/v1/explain/pdf
 *   (vision model) when no selectable text is found.
 * - A single image uses POST /api/v1/explain/image (vision model).
 * - Multiple images use POST /api/v1/explain/images (vision model).
 */
async function generateExplanationFromFile(
  params: GenerateExplanationFromFileParams,
): Promise<ExplanationWithSource> {
  const {
    files,
    topicHint,
    stack = 'openai',
    outputLanguage = 'english',
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

  if (hasPdf) {
    const extractForm = new FormData()
    extractForm.append('file', files[0])

    let sourceText = ''
    try {
      const { data: extracted } = await api.post<{ chapter_text: string; notes?: string }>(
        '/explain/pdf-extract',
        extractForm,
      )
      sourceText = extracted.chapter_text?.trim() ?? ''
    } catch {
      // Scanned/image-only PDF — fall back to vision explain endpoint.
      const visionForm = new FormData()
      appendExplainFormFields(visionForm, topicHint, stack, outputLanguage)
      visionForm.append('file', files[0])
      const { data } = await api.post<ExplainResponse>('/explain/pdf', visionForm)
      const explanation = toExplanation(data)
      const visionSource =
        data.source_text_used_for_context?.trim() || explanation.markdown
      return { explanation, sourceText: visionSource }
    }

    if (!sourceText) {
      throw new Error(
        'No text could be extracted from the uploaded file. Upload a PDF with selectable text, paste the content as plain text, or try image uploads instead.',
      )
    }

    try {
      const explanation = await generateExplanation({
        chapterText: sourceText,
        topicHint,
        stack,
        outputLanguage,
        fromPdf: true,
      })
      return { explanation, sourceText }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Explanation generation failed.'
      throw new ExplanationGenerationError(message, sourceText)
    }
  }

  const form = new FormData()
  appendExplainFormFields(form, topicHint, stack, outputLanguage)

  let endpoint: string
  if (files.length === 1) {
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

export const explanationService = {
  generateExplanation,
  generateExplanationFromFile,
  isImageFile,
  isPdfFile,
}
export default explanationService
