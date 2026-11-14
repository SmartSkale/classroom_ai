import { createContext, useContext } from 'react'
import type { ExplainResponse, ModelStack, OutputLanguageCode } from '../api'

export type SourceMode = 'text' | 'pdf' | 'images'

export type SourceContextValue = {
  mode: SourceMode
  setMode: (mode: SourceMode) => void
  chapterText: string
  setChapterText: (text: string) => void
  pdfFile: File | null
  setPdfFile: (file: File | null) => void
  pdfOcrPages: boolean
  setPdfOcrPages: (on: boolean) => void
  pdfOcrImages: boolean
  setPdfOcrImages: (on: boolean) => void
  files: File[]
  setFiles: (files: File[]) => void
  topicHint: string
  setTopicHint: (hint: string) => void
  stack: ModelStack
  setStack: (stack: ModelStack) => void
  outputLanguage: OutputLanguageCode
  setOutputLanguage: (lang: OutputLanguageCode) => void
  /** Lesson written from the current source, if one has been read. */
  lesson: ExplainResponse | null
  lessonBusy: boolean
  /** Short label such as "Chapter text · 1,240 characters". */
  sourceLabel: string
  /** Topic name used by every tab. */
  topic: string
  hasSource: boolean
  /** Reads the source into a lesson (PDF and screenshots need this; text can skip it). */
  prepareLesson: () => Promise<ExplainResponse>
  /** Returns the grounding text for a tab, reading PDF or screenshots first if needed. */
  getContext: () => Promise<string>
}

export const SourceContext = createContext<SourceContextValue | null>(null)

export function useSource(): SourceContextValue {
  const value = useContext(SourceContext)
  if (!value) throw new Error('useSource must be used inside <SourceProvider>')
  return value
}
