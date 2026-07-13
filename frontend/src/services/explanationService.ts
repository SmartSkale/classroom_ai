import api from './api'

export type OutputLanguage = 'english' | 'hindi' | 'roman_hindi'

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
  file: File
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

/**
 * Generate an explanation directly from an uploaded file (PDF or image) and
 * return both the explanation and the extracted source text.
 *
 * - PDFs use POST /api/v1/explain/pdf (server extracts text + OCR and echoes it
 *   back in `source_text_used_for_context`).
 * - Images use POST /api/v1/explain/image (vision model). There is no extracted
 *   plain text, so the generated markdown doubles as the grounding context.
 */
async function generateExplanationFromFile(
  params: GenerateExplanationFromFileParams,
): Promise<ExplanationWithSource> {
  const { file, topicHint, stack = 'openai', outputLanguage = 'english' } = params

  if (!isPdfFile(file) && !isImageFile(file)) {
    throw new Error('Unsupported file type for extraction. Use a PDF or image.')
  }

  const form = new FormData()
  form.append('file', file)
  form.append('output_language', outputLanguage)
  if (topicHint?.trim()) form.append('topic_hint', topicHint.trim())
  form.append('stack', stack)

  const endpoint = isPdfFile(file) ? '/explain/pdf' : '/explain/image'
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
