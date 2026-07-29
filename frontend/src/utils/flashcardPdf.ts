import { jsPDF } from 'jspdf'
import type { Flashcard } from '../services/generationService'

const CARD_PADDING = 12
const LABEL_WIDTH = 22
const LINE_HEIGHT = 14
const BODY_FONT_SIZE = 11
const LABEL_FONT_SIZE = 12
const CARD_NUMBER_FONT_SIZE = 11
const CARD_NUMBER_GAP = 18 // space between card number and Q/A labels

/**
 * Build a printable flashcard PDF and return the raw bytes (for ZIP bundles).
 */
export function buildFlashcardsPdfBlob(
  topic: string,
  cards: Flashcard[],
  order: number[],
): Uint8Array {
  const doc = buildFlashcardsDoc(topic, cards, order)
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

/**
 * Build a printable flashcard PDF with the front (question) and back (answer)
 * of every card laid out together on the page, in the given order, and trigger
 * a download. Throws if the document cannot be created.
 */
export function downloadFlashcardsPdf(
  topic: string,
  cards: Flashcard[],
  order: number[],
  filename: string,
): void {
  const doc = buildFlashcardsDoc(topic, cards, order)
  doc.save(filename)
}

function buildFlashcardsDoc(topic: string, cards: Flashcard[], order: number[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const textX = margin + CARD_PADDING + LABEL_WIDTH
  const textMaxWidth = contentWidth - CARD_PADDING * 2 - LABEL_WIDTH
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(topic || 'Flashcards', margin, y)
  y += 22
  doc.setFont('helvetica', 'normal')
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

  const splitBodyText = (value: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
    return doc.splitTextToSize(value, textMaxWidth)
  }

  order.forEach((cardIndex, position) => {
    const card = cards[cardIndex]
    if (!card) return

    const frontLines = splitBodyText(card.front)
    const backLines = splitBodyText(card.back)
    const headerHeight = CARD_NUMBER_FONT_SIZE + CARD_NUMBER_GAP
    const frontHeight = frontLines.length * LINE_HEIGHT
    const backHeight = backLines.length * LINE_HEIGHT
    const blockHeight =
      headerHeight + frontHeight + 10 + backHeight + CARD_PADDING * 2

    ensureSpace(blockHeight)
    const top = y

    // Card number (baseline at top of block; gap follows before Q/A)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(CARD_NUMBER_FONT_SIZE)
    doc.setTextColor(90)
    doc.text(`Card ${position + 1}`, margin + CARD_PADDING, y + CARD_NUMBER_FONT_SIZE)
    doc.setTextColor(0)
    y += headerHeight

    // Front (question)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.text('Q:', margin + CARD_PADDING, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
    doc.text(frontLines, textX, y, { maxWidth: textMaxWidth, lineHeightFactor: 1.2 })
    y += frontHeight + 10

    // Back (answer)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(LABEL_FONT_SIZE)
    doc.text('A:', margin + CARD_PADDING, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(BODY_FONT_SIZE)
    doc.text(backLines, textX, y, { maxWidth: textMaxWidth, lineHeightFactor: 1.2 })
    y += backHeight + CARD_PADDING

    // Border around the card block
    doc.setDrawColor(210)
    doc.roundedRect(margin, top, contentWidth, y - top, 6, 6)
    y += CARD_PADDING
  })

  return doc
}
