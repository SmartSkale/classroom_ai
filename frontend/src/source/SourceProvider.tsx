import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  explainFromImages,
  explainFromPdf,
  explainFromText,
  type ExplainResponse,
  type ModelStack,
  type OutputLanguageCode,
} from '../api'
import { SourceContext, type SourceContextValue, type SourceMode } from './SourceContext'

function lessonText(lesson: ExplainResponse | null): string {
  if (!lesson) return ''
  const parts = [
    lesson.explanation_markdown?.trim(),
    ...(lesson.simple_examples || []).map((s) => String(s).trim()).filter(Boolean),
    ...(lesson.visual_briefs || []).map((b) => `${b.title}. ${b.description}`.trim()),
  ].filter(Boolean) as string[]
  return parts.join('\n\n')
}

function joinContext(chunks: string[]): string {
  return chunks.map((c) => c.trim()).filter(Boolean).join('\n\n---\n\n')
}

export function SourceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SourceMode>('text')
  const [chapterText, setChapterText] = useState('')
  const [pdfFile, setPdfFileState] = useState<File | null>(null)
  const [pdfOcrPages, setPdfOcrPages] = useState(true)
  const [pdfOcrImages, setPdfOcrImages] = useState(true)
  const [files, setFilesState] = useState<File[]>([])
  const [topicHint, setTopicHint] = useState('')
  const [stack, setStack] = useState<ModelStack>('opensource')
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguageCode>('english')
  const [lesson, setLesson] = useState<ExplainResponse | null>(null)
  const [lessonBusy, setLessonBusy] = useState(false)

  // A new PDF or screenshot set means the old lesson no longer matches the source.
  const setPdfFile = useCallback((file: File | null) => {
    setPdfFileState(file)
    setLesson(null)
  }, [])
  const setFiles = useCallback((next: File[]) => {
    setFilesState(next)
    setLesson(null)
  }, [])

  const topic = useMemo(() => {
    const text = chapterText.trim()
    return (
      topicHint.trim() ||
      (mode === 'text' && text ? text.split('\n')[0].slice(0, 120) : '') ||
      (mode === 'pdf' && pdfFile ? pdfFile.name.replace(/\.pdf$/i, '').slice(0, 120) : '') ||
      'Current chapter topic'
    )
  }, [topicHint, mode, chapterText, pdfFile])

  const hasSource =
    mode === 'text' ? chapterText.trim().length > 0 : mode === 'pdf' ? pdfFile !== null : files.length > 0

  const sourceLabel = useMemo(() => {
    const readState = lesson ? 'read' : 'not read yet'
    if (mode === 'text') {
      const n = chapterText.trim().length
      return n > 0 ? `Chapter text · ${n.toLocaleString()} characters` : 'Chapter text · empty'
    }
    if (mode === 'pdf') {
      return pdfFile ? `PDF · ${pdfFile.name} · ${readState}` : 'PDF · no file chosen'
    }
    return files.length > 0
      ? `${files.length} screenshot${files.length === 1 ? '' : 's'} · ${readState}`
      : 'Screenshots · none chosen'
  }, [mode, chapterText, pdfFile, files, lesson])

  const prepareLesson = useCallback(async (): Promise<ExplainResponse> => {
    setLessonBusy(true)
    try {
      let data: ExplainResponse
      if (mode === 'text') {
        if (!chapterText.trim()) throw new Error('Paste some chapter text first.')
        data = await explainFromText(chapterText, outputLanguage, topicHint, stack)
      } else if (mode === 'pdf') {
        if (!pdfFile) throw new Error('Choose a PDF file first.')
        data = await explainFromPdf(pdfFile, outputLanguage, topicHint, stack, pdfOcrPages, pdfOcrImages)
        const extracted = data.source_text_used_for_context?.trim()
        if (extracted) setChapterText(extracted)
      } else {
        if (files.length === 0) throw new Error('Choose one or more screenshots first.')
        data = await explainFromImages(files, outputLanguage, topicHint, stack)
      }
      setLesson(data)
      return data
    } finally {
      setLessonBusy(false)
    }
  }, [mode, chapterText, pdfFile, files, outputLanguage, topicHint, stack, pdfOcrPages, pdfOcrImages])

  const getContext = useCallback(async (): Promise<string> => {
    if (mode === 'text') {
      if (!chapterText.trim()) throw new Error('Add chapter text in Source first.')
      return joinContext([chapterText, lessonText(lesson)])
    }
    if (mode === 'pdf' && !pdfFile) throw new Error('Choose a PDF in Source first.')
    if (mode === 'images' && files.length === 0) throw new Error('Choose screenshots in Source first.')

    // PDF and screenshots need reading once; later tabs reuse the lesson and extracted text.
    const current = lesson ?? (await prepareLesson())
    const extracted = mode === 'pdf' ? (chapterText.trim() || current.source_text_used_for_context?.trim() || '') : ''
    const ctx = joinContext([extracted, lessonText(current)])
    if (!ctx) throw new Error('The source did not produce any text to work from.')
    return ctx
  }, [mode, chapterText, pdfFile, files, lesson, prepareLesson])

  const value: SourceContextValue = {
    mode,
    setMode,
    chapterText,
    setChapterText,
    pdfFile,
    setPdfFile,
    pdfOcrPages,
    setPdfOcrPages,
    pdfOcrImages,
    setPdfOcrImages,
    files,
    setFiles,
    topicHint,
    setTopicHint,
    stack,
    setStack,
    outputLanguage,
    setOutputLanguage,
    lesson,
    lessonBusy,
    sourceLabel,
    topic,
    hasSource,
    prepareLesson,
    getContext,
  }

  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>
}
