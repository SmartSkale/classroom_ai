import type { jsPDF } from 'jspdf'

const LATIN_FONT = 'helvetica'
const INDIC_PATTERN = /[\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF\u0C00-\u0C7F]/

export interface TextRun {
  font: string
  text: string
}

function measureText(doc: jsPDF, font: string, fontSize: number, text: string): number {
  doc.setFont(font, 'normal')
  doc.setFontSize(fontSize)
  return doc.getTextWidth(text)
}

function drawText(doc: jsPDF, font: string, fontSize: number, text: string, x: number, y: number): void {
  doc.setFont(font, 'normal')
  doc.setFontSize(fontSize)
  doc.text(text, x, y)
}

export function splitIntoScriptRuns(text: string, bodyFont: string): TextRun[] {
  const runs: TextRun[] = []
  let buffer = ''
  let mode: 'latin' | 'indic' | null = null

  const flush = () => {
    if (!buffer) return
    runs.push({ font: mode === 'indic' ? bodyFont : LATIN_FONT, text: buffer })
    buffer = ''
  }

  for (const char of text) {
    const indic = INDIC_PATTERN.test(char)
    const nextMode = indic ? 'indic' : 'latin'
    if (mode === null) {
      mode = nextMode
      buffer = char
      continue
    }
    if (nextMode === mode) {
      buffer += char
    } else {
      flush()
      mode = nextMode
      buffer = char
    }
  }

  flush()
  return runs
}

/**
 * jsPDF truncates long custom-font strings in a single draw call. Render in small
 * pieces and wrap when the cursor passes maxWidth.
 */
export function drawMixedScriptText(
  doc: jsPDF,
  text: string,
  bodyFont: string,
  startX: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
): number {
  const runs = splitIntoScriptRuns(text, bodyFont)
  let x = startX
  let y = startY
  let lines = 1

  const newline = () => {
    x = startX
    y += lineHeight
    lines += 1
  }

  const placeToken = (font: string, token: string) => {
    if (!token) return

    const tokenWidth = measureText(doc, font, fontSize, token)
    if (tokenWidth > maxWidth) {
      for (const char of token) {
        const charWidth = measureText(doc, font, fontSize, char)
        if (x + charWidth > startX + maxWidth && x > startX) newline()
        drawText(doc, font, fontSize, char, x, y)
        x += charWidth
      }
      return
    }

    if (x + tokenWidth > startX + maxWidth && x > startX) newline()
    drawText(doc, font, fontSize, token, x, y)
    x += tokenWidth
  }

  for (const run of runs) {
    const tokens = run.text.match(/\S+|\s+/g) ?? [run.text]
    for (const token of tokens) {
      placeToken(run.font, token)
    }
  }

  return lines * lineHeight
}

export function measureMixedScriptText(
  doc: jsPDF,
  text: string,
  bodyFont: string,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
): number {
  const runs = splitIntoScriptRuns(text, bodyFont)
  let x = 0
  let lines = 1

  const newline = () => {
    x = 0
    lines += 1
  }

  const placeToken = (font: string, token: string) => {
    if (!token) return
    const tokenWidth = measureText(doc, font, fontSize, token)
    if (tokenWidth > maxWidth) {
      for (const char of token) {
        const charWidth = measureText(doc, font, fontSize, char)
        if (x + charWidth > maxWidth && x > 0) newline()
        x += charWidth
      }
      return
    }
    if (x + tokenWidth > maxWidth && x > 0) newline()
    x += tokenWidth
  }

  for (const run of runs) {
    const tokens = run.text.match(/\S+|\s+/g) ?? [run.text]
    for (const token of tokens) placeToken(run.font, token)
  }

  return lines * lineHeight
}
