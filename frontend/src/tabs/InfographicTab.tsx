import { useState } from 'react'
import { generateInfographic } from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Notice, PageHeader } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

type Result = { src: string; prompt: string }

export function InfographicTab() {
  const s = useSource()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const generate = async () => {
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Drawing the infographic…')
      const res = await generateInfographic({
        topic: s.topic,
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
      })
      setResult({ src: `data:${res.mime_type};base64,${res.image_base64}`, prompt: res.image_prompt_used || '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Infographic"
        description="A one-page visual summary of the topic. Drawn with the OpenAI image model, or a local Stable Diffusion server with the open-source stack. Labels are kept out of the image on purpose."
      />
      <SourceBar />

      <Card
        title="Infographic"
        actions={
          result ? (
            <Button variant="secondary" icon="download" onClick={() => downloadImage(result.src, s.topic)}>
              Download
            </Button>
          ) : null
        }
      >
        <div className="row-wrap">
          <Button icon="image" loading={busy} onClick={generate}>
            {busy ? status ?? 'Drawing…' : result ? 'Draw again' : 'Generate infographic'}
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}

        {!result && !busy && (
          <EmptyState icon="image" title="No infographic yet">
            Generate one from the same source as the rest of your lesson.
          </EmptyState>
        )}

        {result && (
          <div className="infographic-wrap">
            <img className="infographic-img" src={result.src} alt={`Infographic about ${s.topic}`} />
            {result.prompt ? (
              <details className="infographic-prompt-details">
                <summary>Image prompt used</summary>
                <pre>{result.prompt}</pre>
              </details>
            ) : null}
          </div>
        )}
      </Card>
    </>
  )
}

function downloadImage(src: string, topic: string) {
  const a = document.createElement('a')
  a.href = src
  a.download = `${topic.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'infographic'}.png`
  a.click()
}
