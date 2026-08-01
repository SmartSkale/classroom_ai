import { jsPDF } from 'jspdf'
import type { Flashcard } from '../services/generationService'
import type { OutputLanguageId } from './constants'
import { drawMixedScriptText, measureMixedScriptText } from './pdfMixedText'
import { registerPdfFont, resolvePdfScriptFont, textMatchesScript } from './pdfFonts'

const LATIN_FONT = 'helvetica'
const CARD_PADDING = 12
const LABEL_WIDTH = 22
const BODY_FONT_SIZE = 11
const LABEL_FONT_SIZE = 12
const CARD_NUMBER_FONT_SIZE = 11
const CARD_NUMBER_GAP = 18
const LINE_HEIGHT_FACTOR = 1.2
const QA_GAP = 10

function bodyLineHeight(): number {
  return BODY_FONT_SIZE * LINE_HEIGHT_FACTOR
}

/**
 * Build a printable flashcard PDF and return the raw bytes (for ZIP bundles).
 */
export async function buildFlashcardsPdfBlob(
  topic: string,
  cards: Flashcard[],
  order: number[],
  outputLanguage?: OutputLanguageId,
): Promise<Uint8Array> {
  const doc = await buildFlashcardsDoc(topic, cards, order, outputLanguage)
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

/**
 * Build a printable flashcard PDF with the front (question) and back (answer)
 * of every card laid out together on the page, in the given order, and trigger
 * a download. Throws if the document cannot be created.
 */
export async function downloadFlashcardsPdf(
  topic: string,
  cards: Flashcard[],
  order: number[],
  filename: string,
  outputLanguage?: OutputLanguageId,
): Promise<void> {
  const doc = await buildFlashcardsDoc(topic, cards, order, outputLanguage)
  doc.save(filename)
}

async function buildFlashcardsDoc(
  topic: string,
  cards: Flashcard[],
  order: number[],
  outputLanguage?: OutputLanguageId,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const cardTexts = cards.flatMap((card) => [card.front, card.back])
  const script = resolvePdfScriptFont(outputLanguage, topic, ...cardTexts)
  const usesMixedScript = script !== 'helvetica'
  const bodyFont = usesMixedScript ? await registerPdfFont(doc, script) : LATIN_FONT

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const textX = margin + CARD_PADDING + LABEL_WIDTH
  const textMaxWidth = contentWidth - CARD_PADDING * 2 - LABEL_WIDTH
  const lineHeight = bodyLineHeight()
  let y = margin

  if (usesMixedScript && textMatchesScript(topic, script)) {
    drawMixedScriptText(doc, topic || 'Flashcards', bodyFont, margin, y, contentWidth, 18, 22)
    y += 22
  } else {
    doc.setFont(LATIN_FONT, 'bold')
    doc.setFontSize(18)
    doc.text(topic || 'Flashcards', margin, y)
    y += 22
  }

  doc.setFont(LATIN_FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`${cards.length} cards`, margin, y)
  doc.setTextColor(0)
  y += 24

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  const measureBodyText = (value: string) => {
    if (usesMixedScript) {
      return measureMixedScriptText(doc, value, bodyFont, textMaxWidth, BODY_FONT_SIZE, lineHeight)
    }
    doc.setFont(LATIN_FONT, 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
    return doc.splitTextToSize(value, textMaxWidth).length * lineHeight
  }

  const drawBodyText = (value: string, startY: number) => {
    if (usesMixedScript) {
      return drawMixedScriptText(
        doc,
        value,
        bodyFont,
        textX,
        startY,
        textMaxWidth,
        BODY_FONT_SIZE,
        lineHeight,
      )
    }
    doc.setFont(LATIN_FONT, 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
    const lines = doc.splitTextToSize(value, textMaxWidth)
    doc.text(lines, textX, startY, { lineHeightFactor: LINE_HEIGHT_FACTOR })
    return lines.length * lineHeight
  }

  order.forEach((cardIndex, position) => {
    const card = cards[cardIndex]
    if (!card) return

    const frontHeight = measureBodyText(card.front)
    const backHeight = measureBodyText(card.back)
    const headerHeight = CARD_NUMBER_FONT_SIZE + CARD_NUMBER_GAP
    const blockHeight = headerHeight + frontHeight + QA_GAP + backHeight + CARD_PADDING * 2

    ensureSpace(blockHeight)
    const top = y

    doc.setFont(LATIN_FONT, 'bold')
    doc.setFontSize(CARD_NUMBER_FONT_SIZE)
    doc.setTextColor(90)
    doc.text(`Card ${position + 1}`, margin + CARD_PADDING, y + CARD_NUMBER_FONT_SIZE)
    doc.setTextColor(0)
    y += headerHeight

    doc.setFont(LATIN_FONT, 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.text('Q:', margin + CARD_PADDING, y)
    y += drawBodyText(card.front, y) + QA_GAP

    doc.setFont(LATIN_FONT, 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.text('A:', margin + CARD_PADDING, y)
    y += drawBodyText(card.back, y) + CARD_PADDING

    doc.setDrawColor(210)
    doc.roundedRect(margin, top, contentWidth, y - top, 6, 6)
    y += CARD_PADDING
  })

  return doc
}
