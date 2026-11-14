import { useEffect, useRef, useState } from 'react'
import { fetchSpeechBlob, generateSpeech, type SpeechResponse } from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'

export function ListenTab() {
  const s = useSource()
  const [voice, setVoice] = useState<OpenAIVoice>('nova')
  const [ttsModel, setTtsModel] = useState<'tts-1' | 'tts-1-hd'>('tts-1')
  const [edgeVoice, setEdgeVoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<SpeechResponse | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  // Keep one object URL alive at a time and release it on unmount.
  useEffect(() => {
    urlRef.current = audioUrl
  }, [audioUrl])
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const generate = async () => {
    setError(null)
    setInfo(null)
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setAudioUrl(null)
    setBusy(true)
    try {
      setStatus('Reading your source…')
      const ctx = await s.getContext()
      setStatus('Recording narration…')
      const res = await generateSpeech({
        context_text: ctx,
        output_language: s.outputLanguage,
        stack: s.stack,
        openai_voice: voice,
        openai_tts_model: ttsModel,
        edge_voice: edgeVoice.trim() || null,
      })
      const blob = await fetchSpeechBlob(res.audio_id)
      setInfo(res)
      setAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setStatus(null)
    }
  }

  const download = () => {
    if (!audioUrl || !info) return
    const a = document.createElement('a')
    a.href = audioUrl
    a.download = info.filename
    a.rel = 'noopener'
    a.click()
  }

  return (
    <>
      <PageHeader
        title="Listen"
        description="Narrate the lesson as audio for revision on the go. Pick a voice that suits your learners."
      />
      <SourceBar />

      <Card title="Voice settings">
        <div className="settings-row">
          {s.stack === 'openai' ? (
            <>
              <Field label="Voice">
                <select value={voice} onChange={(e) => setVoice(e.target.value as OpenAIVoice)}>
                  <option value="alloy">Alloy</option>
                  <option value="echo">Echo</option>
                  <option value="fable">Fable</option>
                  <option value="onyx">Onyx</option>
                  <option value="nova">Nova</option>
                  <option value="shimmer">Shimmer</option>
                </select>
              </Field>
              <Field label="Quality">
                <select value={ttsModel} onChange={(e) => setTtsModel(e.target.value as 'tts-1' | 'tts-1-hd')}>
                  <option value="tts-1">Standard (faster)</option>
                  <option value="tts-1-hd">High definition</option>
                </select>
              </Field>
            </>
          ) : (
            <Field label="Voice override (optional)" hint="Leave empty to pick a voice for the output language.">
              <input
                value={edgeVoice}
                onChange={(e) => setEdgeVoice(e.target.value)}
                placeholder="e.g. hi-IN-SwaraNeural"
              />
            </Field>
          )}
        </div>
        <div className="row-wrap">
          <Button icon="audio" loading={busy} onClick={generate}>
            {busy ? status ?? 'Recording…' : audioUrl ? 'Record again' : 'Generate lesson audio'}
          </Button>
          <Button variant="secondary" icon="download" disabled={!audioUrl || !info} onClick={download}>
            Download MP3
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {info && (
          <p className="muted">
            Engine: <strong>{info.engine === 'openai_tts' ? 'OpenAI TTS' : 'edge-tts'}</strong> · {info.characters_used.toLocaleString()}{' '}
            characters narrated
            {info.translation_applied ? ' · translated to the output language' : ''}
            {info.truncated ? ' · the source was shortened for one request' : ''}
          </p>
        )}
      </Card>

      {!audioUrl && !busy && (
        <Card>
          <EmptyState icon="audio" title="No audio yet">
            The narration follows your source and output language.
          </EmptyState>
        </Card>
      )}

      {audioUrl && (
        <Card title="Playback">
          <audio className="lesson-audio" src={audioUrl} controls playsInline>
            Your browser does not support audio.
          </audio>
        </Card>
      )}
    </>
  )
}
