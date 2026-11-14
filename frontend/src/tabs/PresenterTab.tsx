import { useEffect, useRef, useState } from 'react'
import {
  fetchSpeechBlob,
  generatePresenterScript,
  generateSpeech,
  type PresenterScript,
} from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader } from '../components/ui'
import { Icon } from '../components/icons'
import { PresenterAvatar } from '../components/PresenterAvatar'
import { SourceBar } from '../components/SourceBar'

export function PresenterTab({ active }: { active: boolean }) {
  const s = useSource()
  const [segmentCount, setSegmentCount] = useState(5)
  const [script, setScript] = useState<PresenterScript | null>(null)
  const [urls, setUrls] = useState<(string | null)[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [mouth, setMouth] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const urlsRef = useRef<(string | null)[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    urlsRef.current = urls
  }, [urls])

  // Release audio, object URLs, and the animation loop on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      urlsRef.current.forEach((u) => u && URL.revokeObjectURL(u))
      ctxRef.current?.close()
    }
  }, [])

  // Pause when the user leaves the tab.
  useEffect(() => {
    if (!active && playing) audioRef.current?.pause()
    if (!active) setPlaying(false)
  }, [active, playing])

  // Load and play the current segment while playback is on.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !playing) return
    const url = urls[index]
    if (!url) {
      setPlaying(false)
      return
    }
    audio.src = url
    audio.play().catch(() => setPlaying(false))
  }, [index, playing, urls])

  // Drive the mouth from the narration's loudness while audio plays.
  useEffect(() => {
    if (!playing) {
      setMouth(0)
      return
    }
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    let smooth = 0
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5)
      smooth = smooth * 0.5 + level * 0.5
      setMouth(smooth)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  const prepare = async () => {
    setError(null)
    setBusy(true)
    setPlaying(false)
    urlsRef.current.forEach((u) => u && URL.revokeObjectURL(u))
    setUrls([])
    setScript(null)
    setIndex(0)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Writing the presentation…')
      const sc = await generatePresenterScript({
        topic: s.topic,
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
        segment_count: segmentCount,
      })
      setScript(sc)
      const built: (string | null)[] = []
      for (let i = 0; i < sc.segments.length; i++) {
        setStatus(`Recording narration ${i + 1} of ${sc.segments.length}…`)
        const seg = sc.segments[i]
        const speech = await generateSpeech({
          context_text: seg.narration,
          output_language: s.outputLanguage,
          stack: s.stack,
          openai_voice: 'nova',
          openai_tts_model: 'tts-1',
          edge_voice: null,
        })
        const blob = await fetchSpeechBlob(speech.audio_id)
        built.push(URL.createObjectURL(blob))
        setUrls([...built])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const ensureAudioGraph = () => {
    if (ctxRef.current || !audioRef.current) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    const source = ctx.createMediaElementSource(audioRef.current)
    source.connect(analyser)
    analyser.connect(ctx.destination)
    ctxRef.current = ctx
    analyserRef.current = analyser
  }

  const togglePlay = () => {
    if (!script || urls.length === 0) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    ensureAudioGraph()
    ctxRef.current?.resume()
    setPlaying(true)
  }

  const go = (next: number) => {
    setIndex(next)
    if (!playing && audioRef.current && urls[next]) audioRef.current.src = urls[next] as string
  }

  const onEnded = () => {
    if (index < urls.length - 1) {
      setIndex(index + 1)
    } else {
      setPlaying(false)
      setIndex(0)
    }
  }

  const segment = script?.segments[index]
  const ready = !!script && urls.length === script.segments.length && urls.every(Boolean)

  return (
    <>
      <PageHeader
        title="Presenter"
        description="An on-screen presenter explains the topic step by step, with narration that matches the character's mouth. The presentation is written from your source."
      />
      <SourceBar />

      <Card title="Presentation settings">
        <div className="settings-row">
          <Field label="Segments" hint="2 to 8 parts, each about a minute">
            <input
              type="number"
              min={2}
              max={8}
              value={segmentCount}
              onChange={(e) => setSegmentCount(Math.max(2, Math.min(8, Number(e.target.value) || 5)))}
            />
          </Field>
        </div>
        <div className="row-wrap">
          <Button icon="presenter" loading={busy} disabled={!s.hasSource} onClick={prepare}>
            {busy ? status ?? 'Preparing…' : script ? 'Prepare a new presentation' : 'Prepare presentation'}
          </Button>
          {!s.hasSource && <span className="muted">Add a source above first.</span>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
      </Card>

      {!script && !busy && (
        <Card>
          <EmptyState icon="presenter" title="No presentation yet">
            Preparing takes a little while, because each part is narrated before the presenter starts.
          </EmptyState>
        </Card>
      )}

      {script && segment && (
        <Card title={script.title} description={`Part ${index + 1} of ${script.segments.length}${ready ? '' : ' · narration still loading'}`}>
          <div className="presenter-stage">
            <PresenterAvatar mouth={mouth} expression={segment.expression} speaking={playing} />
            <div className="presenter-caption">
              <span className="chip">{segment.heading}</span>
              <p>{segment.narration}</p>
            </div>
          </div>

          <audio ref={audioRef} onEnded={onEnded} hidden />

          <div className="presenter-controls">
            <Button variant="secondary" icon="left" disabled={index === 0} onClick={() => go(Math.max(0, index - 1))}>
              Previous
            </Button>
            <Button icon={playing ? 'pause' : 'play'} disabled={!ready} onClick={togglePlay}>
              {playing ? 'Pause' : 'Play presentation'}
            </Button>
            <Button
              variant="secondary"
              icon="right"
              disabled={index >= script.segments.length - 1}
              onClick={() => go(Math.min(script.segments.length - 1, index + 1))}
            >
              Next
            </Button>
          </div>

          <div className="slide-dots presenter-dots" role="tablist" aria-label="Presentation parts">
            {script.segments.map((seg, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Part ${i + 1}: ${seg.heading}`}
                className={`slide-dot ${i === index ? 'active' : ''}`}
                disabled={!urls[i]}
                onClick={() => go(i)}
              />
            ))}
          </div>
          {!ready && (
            <p className="muted presenter-note">
              <Icon name="sparkle" size={14} /> Narration is still loading. Play starts once every part is ready.
            </p>
          )}
        </Card>
      )}
    </>
  )
}
