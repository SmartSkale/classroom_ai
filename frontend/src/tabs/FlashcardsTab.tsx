import { useEffect, useState } from 'react'
import { generateFlashcards, type FlashcardsResponse } from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader, ProgressBar } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

export function FlashcardsTab({ active }: { active: boolean }) {
  const s = useSource()
  const [count, setCount] = useState(12)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deck, setDeck] = useState<FlashcardsResponse | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const total = deck?.cards.length ?? 0

  const go = (next: number) => {
    setIndex(next)
    setFlipped(false)
  }

  useEffect(() => {
    if (!active || total === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(Math.max(0, index - 1))
      if (e.key === 'ArrowRight') go(Math.min(total - 1, index + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, total, index])

  const generate = async () => {
    setError(null)
    setDeck(null)
    setIndex(0)
    setFlipped(false)
    setBusy(true)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Writing cards…')
      const res = await generateFlashcards({
        topic: s.topic,
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
        card_count: count,
      })
      setDeck(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const card = deck?.cards[index]

  return (
    <>
      <PageHeader
        title="Flashcards"
        description="Review key terms and ideas. Flip a card to check the answer, then move through the deck with the arrow keys."
      />
      <SourceBar />

      <Card title="Deck settings">
        <div className="settings-row">
          <Field label="Cards" hint="4 to 40">
            <input
              type="number"
              min={4}
              max={40}
              value={count}
              onChange={(e) => setCount(Math.max(4, Math.min(40, Number(e.target.value) || 12)))}
            />
          </Field>
        </div>
        <div className="row-wrap">
          <Button icon="cards" loading={busy} onClick={generate}>
            {busy ? status ?? 'Generating…' : deck ? 'Generate new deck' : 'Generate flashcards'}
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </Card>

      {!deck && !busy && (
        <Card>
          <EmptyState icon="cards" title="No flashcards yet">
            Cards are written from your source, so they match what you studied.
          </EmptyState>
        </Card>
      )}

      {deck && card && (
        <Card title={`Card ${index + 1} of ${total}`} actions={<Button variant="secondary" icon="flip" onClick={() => setFlipped((f) => !f)}>Flip</Button>}>
          <ProgressBar value={index + 1} max={total} />
          <div
            className="flashcard-scene"
            role="button"
            tabIndex={0}
            onClick={() => setFlipped((f) => !f)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setFlipped((f) => !f)
              }
            }}
            aria-label="Flashcard. Select to flip."
          >
            <div className={`flashcard-inner ${flipped ? 'is-flipped' : ''}`}>
              <div className="flashcard-face flashcard-front">
                <span className="flashcard-label">Question</span>
                <p>{card.front}</p>
              </div>
              <div className="flashcard-face flashcard-back">
                <span className="flashcard-label">Answer</span>
                <p>{card.back}</p>
              </div>
            </div>
          </div>
          <div className="row-wrap space-between">
            <Button variant="secondary" icon="left" disabled={index === 0} onClick={() => go(Math.max(0, index - 1))}>
              Previous
            </Button>
            <Button variant="secondary" disabled={index >= total - 1} onClick={() => go(Math.min(total - 1, index + 1))}>
              Next
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
