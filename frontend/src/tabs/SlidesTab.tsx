import { useEffect, useState } from 'react'
import { fetchSlideDeckBlob, generateSlideDeck, type SlideDeckResponse, type SlideItem } from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

function SlideView({ slide }: { slide: SlideItem }) {
  const bg = slide.background_url ? { backgroundImage: `url(${slide.background_url})` } : undefined

  if (slide.layout === 'cover') {
    return (
      <div className="slide-screen slide-cover" style={bg}>
        <h3 className="slide-title slide-title-cover">{slide.title}</h3>
        <p className="slide-subtitle">{slide.bullets[0]}</p>
        <p className="slide-brand">ClassroomAI</p>
      </div>
    )
  }

  const photo = slide.image_url ? <img className="slide-photo" src={slide.image_url} alt="" /> : null
  const text = (
    <div className="slide-text">
      <h3 className="slide-title">{slide.title}</h3>
      <ul className="slide-bullets">
        {slide.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      {slide.photo_attribution ? <p className="slide-photo-credit">{slide.photo_attribution}</p> : null}
    </div>
  )

  if (slide.layout === 'split_right' && photo) {
    return (
      <div className="slide-screen" style={bg}>
        <div className="slide-split">
          {text}
          {photo}
        </div>
      </div>
    )
  }
  if (slide.layout === 'split_left' && photo) {
    return (
      <div className="slide-screen" style={bg}>
        <div className="slide-split">
          {photo}
          {text}
        </div>
      </div>
    )
  }
  if (slide.layout === 'hero' && photo) {
    return (
      <div className="slide-screen slide-hero" style={bg}>
        {photo}
        {text}
      </div>
    )
  }
  return (
    <div className="slide-screen" style={bg}>
      {text}
    </div>
  )
}

export function SlidesTab({ active }: { active: boolean }) {
  const s = useSource()
  const [count, setCount] = useState(8)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deck, setDeck] = useState<SlideDeckResponse | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active || !deck?.slides.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(deck.slides.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, deck])

  const generate = async () => {
    setError(null)
    setDeck(null)
    setIndex(0)
    setBusy(true)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Designing slides and images…')
      const res = await generateSlideDeck({
        topic: s.topic,
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
        slide_count: count,
      })
      setDeck(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const download = async () => {
    if (!deck) return
    try {
      const blob = await fetchSlideDeckBlob(deck.deck_id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = deck.filename
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const slide = deck?.slides[index]

  return (
    <>
      <PageHeader
        title="Slides"
        description="Build a presentation with a cover, AI-generated images, and speaker notes. Preview it here, then download a .pptx for PowerPoint or Google Slides."
      />
      <SourceBar />

      <Card
        title="Deck settings"
        actions={
          deck ? (
            <Button variant="secondary" icon="download" disabled={busy} onClick={download}>
              Download .pptx
            </Button>
          ) : null
        }
      >
        <div className="settings-row">
          <Field label="Content slides" hint="4 to 20, plus a cover">
            <input
              type="number"
              min={4}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(4, Math.min(20, Number(e.target.value) || 8)))}
            />
          </Field>
        </div>
        <div className="row-wrap">
          <Button icon="slides" loading={busy} onClick={generate}>
            {busy ? status ?? 'Building deck…' : deck ? 'Generate new deck' : 'Generate slide deck'}
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </Card>

      {!deck && !busy && (
        <Card>
          <EmptyState icon="slides" title="No deck yet">
            Each slide gets its own image on a themed background. Generation can take a minute or two.
          </EmptyState>
        </Card>
      )}

      {deck && slide && (
        <Card title={deck.deck_title} description={`Slide ${index + 1} of ${deck.slides.length}`}>
          <div className="slide-frame" aria-live="polite">
            <SlideView slide={slide} />
            {slide.speaker_notes ? (
              <p className="slide-notes">
                <span className="slide-notes-label">Speaker notes</span>
                {slide.speaker_notes}
              </p>
            ) : null}
          </div>
          <div className="slide-nav">
            <Button variant="secondary" icon="left" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              Previous
            </Button>
            <div className="slide-dots" role="tablist" aria-label="Slides">
              {deck.slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`slide-dot ${i === index ? 'active' : ''}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <Button
              variant="secondary"
              icon="right"
              disabled={index >= deck.slides.length - 1}
              onClick={() => setIndex((i) => Math.min(deck.slides.length - 1, i + 1))}
            >
              Next
            </Button>
          </div>
        </Card>
      )}
    </>
  )
}
