import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { generationService } from '../../services/generationService'
import {
  AUDIO_LANGUAGES,
  AUDIO_SPEEDS,
  AUDIO_VOICES,
  ROUTES,
  type AudioLanguageId,
  type AudioSpeedId,
  type AudioVoiceId,
} from '../../utils/constants'
import { isStudent } from '../../utils/roles'
import './Audio.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

const GENERATE_ERROR = 'Audio generation failed. Try a different voice or language.'

function speedRate(id: AudioSpeedId): number {
  return AUDIO_SPEEDS.find((s) => s.id === id)?.rate ?? 1
}

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'audio-lesson'
}

export function Audio() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const studentView = isStudent(user)
  const { jobs, cacheResults } = useGeneration()
  const job = jobs[id]
  const navState = location.state as { name?: string; text?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text ?? ''
  const cachedAudio = job?.results.audio ?? null

  const [voice, setVoice] = useState<AudioVoiceId>(
    (cachedAudio?.voice as AudioVoiceId) ?? AUDIO_VOICES[0].id,
  )
  const [speed, setSpeed] = useState<AudioSpeedId>('normal')
  const [language, setLanguage] = useState<AudioLanguageId>(
    (cachedAudio?.outputLanguage as AudioLanguageId) ??
      job?.outputLanguage ??
      AUDIO_LANGUAGES[0].id,
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>('audio-lesson.mp3')
  const [notice, setNotice] = useState<string | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const audioRef = useRef<HTMLAudioElement>(null)
  // Hold the blob so Download MP3 doesn't need a second authenticated request.
  const blobRef = useRef<Blob | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  const setBlob = useCallback((blob: Blob, name: string) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(blob)
    objectUrlRef.current = url
    blobRef.current = blob
    setFilename(name)
    setAudioUrl(url)
  }, [])

  // Restore a previously generated clip (from upfront generation) so the player
  // appears without regenerating.
  useEffect(() => {
    let cancelled = false
    if (!cachedAudio || audioUrl) return
    void (async () => {
      try {
        const blob = await generationService.downloadAudio(cachedAudio.audioId)
        if (!cancelled) setBlob(blob, cachedAudio.filename)
      } catch {
        // Ignore — the user can simply regenerate.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cachedAudio, audioUrl, setBlob])

  // Apply the selected playback speed to the audio element.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speedRate(speed)
  }, [speed, audioUrl])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  async function handleGenerate() {
    if (sourceText.trim().length < 20) {
      setError('Not enough lesson text to narrate. Add an explanation first.')
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const result = await generationService.generateAudio(sourceText, {
        voice,
        outputLanguage: language,
      })
      cacheResults(id, { audio: result })
      const blob = await generationService.downloadAudio(result.audioId)
      setBlob(blob, result.filename)
      if (result.truncated) {
        setNotice('The lesson was long, so only the first portion was narrated.')
      } else if (result.translationApplied) {
        setNotice('The lesson text was translated to match the selected language.')
      }
    } catch {
      setError(GENERATE_ERROR)
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!blobRef.current) return
    try {
      const url = objectUrlRef.current ?? URL.createObjectURL(blobRef.current)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `${slugify(projectName)}.mp3`
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast({ type: 'success', message: 'Audio downloaded successfully.' })
    } catch {
      showToast({ type: 'error', message: 'Could not download the audio. Please try again.' })
    }
  }

  return (
    <div className="audio">
      <nav className="audio-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="audio-breadcrumb-current">Audio Lesson</span>
      </nav>

      <header className="audio-header">
        <h1 className="audio-title">{studentView ? 'Audio Lesson' : 'Voice Settings'}</h1>
        <p className="audio-subtitle">
          {studentView
            ? 'Listen to the narrated lesson for this chapter.'
            : 'Generate a narrated audio lesson from your content.'}
        </p>
      </header>

      {!studentView && (
      <section className="audio-settings" aria-label="Voice settings">
        <label className="audio-control">
          <span>Voice</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value as AudioVoiceId)}
            disabled={loading}
            required
          >
            {AUDIO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label className="audio-control">
          <span>Speed</span>
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as AudioSpeedId)}
            required
          >
            {AUDIO_SPEEDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="audio-hint">Adjusts playback speed.</span>
        </label>

        <label className="audio-control">
          <span>Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as AudioLanguageId)}
            disabled={loading}
            required
          >
            {AUDIO_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div className="audio-error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <Loader label="Generating audio…" />
        ) : (
          <div className="audio-generate">
            <Button variant="primary" size="lg" onClick={handleGenerate}>
              {audioUrl ? 'Regenerate' : 'Generate Audio'}
            </Button>
          </div>
        )}
      </section>
      )}

      {studentView && !audioUrl && !loading && (
        <div className="audio-empty">
          <p>Audio is not available for this lesson yet.</p>
        </div>
      )}

      {studentView && audioUrl && !loading && (
        <section className="audio-player-card" aria-label="Audio player">
          <h2 className="audio-player-title">Your audio lesson</h2>
          {notice && <p className="audio-notice">{notice}</p>}
          <label className="audio-control audio-control-inline">
            <span>Playback speed</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as AudioSpeedId)}
            >
              {AUDIO_SPEEDS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <audio
            ref={audioRef}
            className="audio-player"
            src={audioUrl}
            controls
            onLoadedMetadata={() => {
              if (audioRef.current) audioRef.current.playbackRate = speedRate(speed)
            }}
          />
        </section>
      )}

      {!studentView && audioUrl && !loading && (
        <section className="audio-player-card" aria-label="Audio player">
          <h2 className="audio-player-title">Your audio lesson</h2>
          {notice && <p className="audio-notice">{notice}</p>}
          <audio
            ref={audioRef}
            className="audio-player"
            src={audioUrl}
            controls
            onLoadedMetadata={() => {
              if (audioRef.current) audioRef.current.playbackRate = speedRate(speed)
            }}
          />
          <div className="audio-player-actions">
            <Button variant="primary" onClick={handleDownload}>
              Download MP3
            </Button>
            <Button variant="outline" onClick={handleGenerate}>
              Regenerate
            </Button>
          </div>
        </section>
      )}

      <ProjectOutputNav
        projectId={id}
        activeOutput="audio"
        projectName={projectName}
        sourceText={sourceText}
        studentView={studentView}
      />

      {toast && (
        <div className={`audio-toast audio-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Audio
