import type { jsPDF } from 'jspdf'
import type { OutputLanguageId } from './constants'

/** Indic script families used by flashcard PDF export. */
export type PdfScriptFont = 'devanagari' | 'bengali' | 'telugu' | 'tamil'

interface FontConfig {
  family: string
  regularFile: string
  boldFile: string
}

const FONT_CONFIGS: Record<PdfScriptFont, FontConfig> = {
  devanagari: {
    family: 'NotoSansDevanagari',
    regularFile: 'NotoSansDevanagari-Regular.ttf',
    boldFile: 'NotoSansDevanagari-Bold.ttf',
  },
  bengali: {
    family: 'NotoSansBengali',
    regularFile: 'NotoSansBengali-Regular.ttf',
    boldFile: 'NotoSansBengali-Bold.ttf',
  },
  telugu: {
    family: 'NotoSansTelugu',
    regularFile: 'NotoSansTelugu-Regular.ttf',
    boldFile: 'NotoSansTelugu-Bold.ttf',
  },
  tamil: {
    family: 'NotoSansTamil',
    regularFile: 'NotoSansTamil-Regular.ttf',
    boldFile: 'NotoSansTamil-Bold.ttf',
  },
}

const SCRIPT_DETECTORS: { script: PdfScriptFont; pattern: RegExp }[] = [
  { script: 'devanagari', pattern: /[\u0900-\u097F]/ },
  { script: 'bengali', pattern: /[\u0980-\u09FF]/ },
  { script: 'tamil', pattern: /[\u0B80-\u0BFF]/ },
  { script: 'telugu', pattern: /[\u0C00-\u0C7F]/ },
]

const fontDataCache = new Map<string, string>()
const loadPromises = new Map<PdfScriptFont, Promise<void>>()
const registeredOnDoc = new WeakMap<jsPDF, Set<PdfScriptFont>>()

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

async function loadScriptFont(script: PdfScriptFont): Promise<void> {
  const config = FONT_CONFIGS[script]
  if (fontDataCache.has(config.regularFile) && fontDataCache.has(config.boldFile)) return

  const existing = loadPromises.get(script)
  if (existing) {
    await existing
    return
  }

  const promise = (async () => {
    const [regular, bold] = await Promise.all([
      fetch(`/fonts/${config.regularFile}`).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${config.regularFile}`)
        return response.arrayBuffer()
      }),
      fetch(`/fonts/${config.boldFile}`).then((response) => {
        if (!response.ok) throw new Error(`Could not load ${config.boldFile}`)
        return response.arrayBuffer()
      }),
    ])
    fontDataCache.set(config.regularFile, arrayBufferToBase64(regular))
    fontDataCache.set(config.boldFile, arrayBufferToBase64(bold))
  })()

  loadPromises.set(script, promise)
  await promise
}

function languageToScriptFont(language: OutputLanguageId): PdfScriptFont | 'helvetica' {
  switch (language) {
    case 'hindi':
    case 'marathi':
      return 'devanagari'
    case 'bengali':
      return 'bengali'
    case 'telugu':
      return 'telugu'
    case 'tamil':
      return 'tamil'
    default:
      return 'helvetica'
  }
}

function detectScriptFromText(...texts: string[]): PdfScriptFont | null {
  const combined = texts.join('\n')
  for (const { script, pattern } of SCRIPT_DETECTORS) {
    if (pattern.test(combined)) return script
  }
  return null
}

/**
 * Pick the PDF font for a deck: explicit output language wins, then script detection.
 */
export function resolvePdfScriptFont(
  outputLanguage: OutputLanguageId | undefined,
  ...texts: string[]
): PdfScriptFont | 'helvetica' {
  if (outputLanguage) {
    const fromLanguage = languageToScriptFont(outputLanguage)
    if (fromLanguage !== 'helvetica') return fromLanguage
  }
  return detectScriptFromText(...texts) ?? 'helvetica'
}

export function textMatchesScript(text: string, script: PdfScriptFont): boolean {
  const detector = SCRIPT_DETECTORS.find((entry) => entry.script === script)
  return detector ? detector.pattern.test(text) : false
}

export function pdfFontFamily(script: PdfScriptFont | 'helvetica'): string {
  if (script === 'helvetica') return 'helvetica'
  return FONT_CONFIGS[script].family
}

export async function registerPdfFont(
  doc: jsPDF,
  script: PdfScriptFont,
): Promise<string> {
  await loadScriptFont(script)

  const config = FONT_CONFIGS[script]
  const regular = fontDataCache.get(config.regularFile)
  const bold = fontDataCache.get(config.boldFile)
  if (!regular || !bold) {
    throw new Error(`Font data missing for ${config.family}`)
  }

  let registered = registeredOnDoc.get(doc)
  if (!registered) {
    registered = new Set()
    registeredOnDoc.set(doc, registered)
  }

  if (!registered.has(script)) {
    doc.addFileToVFS(config.regularFile, regular)
    doc.addFont(config.regularFile, config.family, 'normal')
    doc.addFileToVFS(config.boldFile, bold)
    doc.addFont(config.boldFile, config.family, 'bold')
    registered.add(script)
  }

  return config.family
}
