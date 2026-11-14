import { useState, Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { generateIllustration, OUTPUT_LANGUAGE_LABELS, type VisualBrief } from '../api'
import { MermaidDiagram } from '../MermaidDiagram'
import { useSource } from '../source/SourceContext'
import { Card, EmptyState, Notice, Segmented, Button } from '../components/ui'
import { SourcePanel } from '../components/SourcePanel'

/** Fenced ```mermaid blocks in the explanation render as diagrams. */
function MarkdownPre({ children, ...rest }: ComponentPropsWithoutRef<'pre'>) {
  const arr = Children.toArray(children)
  const codeEl = arr.find((c) => isValidElement(c) && c.type === 'code')
  if (isValidElement(codeEl)) {
    const cls = String((codeEl.props as { className?: string }).className || '')
    if (cls.includes('language-mermaid')) {
      const raw = String((codeEl.props as { children?: ReactNode }).children ?? '').replace(/\n$/, '')
      return (
        <div className="diagram-box">
          <MermaidDiagram code={raw} />
        </div>
      )
    }
  }
  return <pre {...rest}>{children}</pre>
}

function briefKindLabel(b: VisualBrief): string {
  const f = (b.suggested_format || '').toLowerCase()
  const k = (b.kind || '').toLowerCase()
  if (f.includes('animation') || f.includes('storyboard') || k.includes('animation')) return 'Animation idea'
  if (f.includes('mermaid') || k.includes('diagram') || k.includes('timeline')) return 'Diagram or sequence'
  return 'Visual idea'
}

export function LessonTab() {
  const s = useSource()
  const [error, setError] = useState<string | null>(null)
  const [illustrationSrc, setIllustrationSrc] = useState<string | null>(null)
  const [illustrationErr, setIllustrationErr] = useState<string | null>(null)
  const [illustrationBusy, setIllustrationBusy] = useState(false)
  const [illustrationSource, setIllustrationSource] = useState<'ai' | 'pexels'>('ai')

  const lesson = s.lesson

  const createLesson = async () => {
    setError(null)
    setIllustrationSrc(null)
    try {
      await s.prepareLesson()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const drawIllustration = async () => {
    const first = lesson?.visual_briefs[0]
    if (!first) return
    setIllustrationErr(null)
    setIllustrationBusy(true)
    try {
      const src = await generateIllustration(`${first.title}. ${first.description}`.slice(0, 3500), s.stack, illustrationSource)
      setIllustrationSrc(src)
    } catch (e) {
      setIllustrationErr(e instanceof Error ? e.message : String(e))
    } finally {
      setIllustrationBusy(false)
    }
  }

  return (
    <div className="lesson-layout">
      <div className="lesson-side">
        <Card
          title="Source"
          description={`Output language: ${OUTPUT_LANGUAGE_LABELS[s.outputLanguage]}. Change it in the header.`}
          actions={
            <Button icon="sparkle" loading={s.lessonBusy} disabled={!s.hasSource} onClick={createLesson}>
              {s.lessonBusy ? 'Creating…' : lesson ? 'Create again' : 'Create lesson'}
            </Button>
          }
        >
          <SourcePanel />
        </Card>
      </div>

      <div className="lesson-main">
        <Card
          title="Explanation"
          description={
            lesson
              ? `Written in ${OUTPUT_LANGUAGE_LABELS[lesson.output_language_used ?? s.outputLanguage]} with the ${s.stack === 'openai' ? 'OpenAI' : 'open-source'} stack.`
              : `Will be written in ${OUTPUT_LANGUAGE_LABELS[s.outputLanguage]}.`
          }
        >
          {error && <Notice tone="error">{error}</Notice>}

          {!lesson ? (
            <EmptyState icon="lesson" title={s.lessonBusy ? 'Writing the lesson…' : s.hasSource ? 'Ready when you are' : 'Add a source to begin'}>
              {s.hasSource
                ? 'Press Create lesson. The explanation, diagram, examples, and visual ideas appear here.'
                : 'Paste chapter text, upload a PDF, or add screenshots on the left.'}
            </EmptyState>
          ) : (
            <div className="lesson">
              {lesson.pdf_extraction_notes?.trim() ? (
                <p className="muted">PDF extraction: {lesson.pdf_extraction_notes}</p>
              ) : null}

              <div className="md">
                <ReactMarkdown components={{ pre: MarkdownPre }}>{lesson.explanation_markdown}</ReactMarkdown>
              </div>

              {lesson.mermaid_diagram && (
                <section className="subsection">
                  <h3>Diagram</h3>
                  <div className="diagram-box">
                    <MermaidDiagram code={lesson.mermaid_diagram} />
                  </div>
                  {lesson.diagram_caption?.trim() ? <p className="muted">{lesson.diagram_caption.trim()}</p> : null}
                </section>
              )}

              {lesson.simple_examples.length > 0 && (
                <section className="subsection">
                  <h3>Concrete examples</h3>
                  <ul className="examples">
                    {lesson.simple_examples.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </section>
              )}

              {lesson.visual_briefs.length > 0 && (
                <section className="subsection">
                  <h3>Visual ideas</h3>
                  <div className="briefs">
                    {lesson.visual_briefs.map((b, i) => (
                      <article className="brief" key={i}>
                        <span className="chip">{briefKindLabel(b)}</span>
                        <strong>{b.title}</strong>
                        <p>{b.description}</p>
                      </article>
                    ))}
                  </div>

                  <div className="illustration-controls">
                    <Segmented
                      label="Illustration source"
                      value={illustrationSource}
                      onChange={setIllustrationSource}
                      options={[
                        { value: 'ai', label: 'AI illustration' },
                        { value: 'pexels', label: 'Stock photo' },
                      ]}
                    />
                    <Button variant="secondary" icon="image" loading={illustrationBusy} onClick={drawIllustration}>
                      {illustrationBusy ? 'Drawing…' : 'Illustrate first idea'}
                    </Button>
                  </div>
                  {illustrationSource === 'pexels' && (
                    <p className="muted">Uses the first visual idea as search keywords. Needs PEXELS_API_KEY on the server.</p>
                  )}
                  {illustrationErr && <Notice tone="error">{illustrationErr}</Notice>}
                  {illustrationSrc && (
                    <img
                      className="illustration-img"
                      src={illustrationSrc}
                      alt={illustrationSource === 'pexels' ? 'Stock photo for the lesson' : 'AI illustration for the lesson'}
                    />
                  )}
                </section>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
