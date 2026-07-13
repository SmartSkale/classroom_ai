import { jsPDF } from 'jspdf'
import type { Flashcard } from '../services/generationService'

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

  order.forEach((cardIndex, position) => {
    const card = cards[cardIndex]
    if (!card) return

    const frontLines = doc.splitTextToSize(card.front, contentWidth - 16)
    const backLines = doc.splitTextToSize(card.back, contentWidth - 16)
    const blockHeight = 28 + frontLines.length * 14 + 18 + backLines.length * 14 + 24

    ensureSpace(blockHeight)
    const top = y

    // Card number
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(90)
    doc.text(`Card ${position + 1}`, margin + 8, y + 18)
    doc.setTextColor(0)
    y += 28

    // Front (question)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Q:', margin + 8, y)
    doc.setFont('helvetica', 'normal')
    doc.text(frontLines, margin + 28, y)
    y += frontLines.length * 14 + 12

    // Back (answer)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('A:', margin + 8, y)
    doc.setFont('helvetica', 'normal')
    doc.text(backLines, margin + 28, y)
    y += backLines.length * 14 + 12

    // Border around the card block
    doc.setDrawColor(210)
    doc.roundedRect(margin, top, contentWidth, y - top + 4, 6, 6)
    y += 18
  })

  return doc
}
