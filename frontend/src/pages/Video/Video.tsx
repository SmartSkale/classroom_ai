import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectFailures } from '../../components/ProjectFailures/ProjectFailures'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { useProjectJob } from '../../hooks/useProjectJob'
import { useProjectOutputState } from '../../hooks/useProjectOutputState'
import { generationService } from '../../services/generationService'
import { useAuth } from '../../hooks/useAuth'
import { isStudent } from '../../utils/roles'
import { ROUTES, projectRoute } from '../../utils/constants'
import { getStepFailure } from '../../utils/projectStatus'
import './Video.css'

const POLL_MS = 3000
const COMPLETE_STATUSES = new Set(['completed', 'complete', 'succeeded', 'success', 'done'])
const FAILED_STATUSES = new Set(['failed', 'error', 'cancelled'])

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'lesson-video'
}

export function Video() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user } = useAuth()
  const studentView = isStudent(user)
  const { regenerateOutput } = useGeneration()
  const { job, loading: jobLoading, loadError } = useProjectJob(id)
  const { isGenerating, generatingLabel } = useProjectOutputState(
    job,
    'video',
    false,
    'Generating video…',
  )
  const navState = location.state as { name?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const cachedVideo = job?.results.video ?? null

  const [status, setStatus] = useState(cachedVideo?.status ?? 'queued')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const blobRef = useRef<Blob | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const pollRef = useRef<number | undefined>(undefined)

  const loadVideoFile = useCallback(async (videoId: string) => {
    try {
      const blob = await generationService.downloadVideo(videoId)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      blobRef.current = blob
      setVideoUrl(url)
    } catch {
      setError('Video is ready but could not be loaded. Try downloading instead.')
    }
  }, [])

  useEffect(() => {
    if (!cachedVideo?.videoId) return

    let cancelled = false

    async function poll() {
      try {
        const result = await generationService.getVideoJobStatus(cachedVideo!.videoId)
        if (cancelled) return

        const normalized = result.status.toLowerCase()
        setStatus(result.status)
        setProgress(result.progress ?? null)

        if (FAILED_STATUSES.has(normalized)) {
          setError(result.error?.message ?? 'Video generation failed.')
          return
        }

        if (COMPLETE_STATUSES.has(normalized)) {
          await loadVideoFile(cachedVideo!.videoId)
          return
        }

        pollRef.current = window.setTimeout(() => void poll(), POLL_MS)
      } catch {
        if (!cancelled) setError('Could not check video status.')
      }
    }

    const initial = cachedVideo.status.toLowerCase()
    if (COMPLETE_STATUSES.has(initial)) {
      void loadVideoFile(cachedVideo.videoId)
    } else if (!FAILED_STATUSES.has(initial)) {
      void poll()
    } else {
      setError('Video generation failed.')
    }

    return () => {
      cancelled = true
      window.clearTimeout(pollRef.current)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [cachedVideo, loadVideoFile])

  async function handleRegenerate() {
    if (!id) return
    setError(null)
    setVideoUrl(null)
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
    blobRef.current = null
    const ok = await regenerateOutput(id, 'video', {
      sourceText: job?.sourceText,
      topicHint: projectName,
    })
    if (!ok) {
      setError('Could not start video generation. Open the project once, then try again.')
    }
  }

  async function handleDownload() {
    if (!cachedVideo?.videoId) return
    setDownloading(true)
    try {
      const blob = blobRef.current ?? (await generationService.downloadVideo(cachedVideo.videoId))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slugify(projectName)}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed. Try again in a moment.')
    } finally {
      setDownloading(false)
    }
  }

  if (!cachedVideo) {
    const videoFailed = getStepFailure(job, 'video')
    return (
      <div className="video-page">
        <nav className="video-breadcrumb" aria-label="Breadcrumb">
          <Link to={studentView ? ROUTES.dashboard : ROUTES.library}>
            {studentView ? 'My Lessons' : 'Library'}
          </Link>
          <span aria-hidden="true">/</span>
          <span>Video</span>
        </nav>

        {jobLoading && <Loader label="Loading project…" />}

        {!jobLoading && loadError && (
          <div className="video-error" role="alert">
            {loadError}
          </div>
        )}

        {!jobLoading && !loadError && isGenerating && (
          <Loader label={generatingLabel} fullscreen />
        )}

        {!jobLoading && !loadError && !isGenerating && videoFailed && (
          <ProjectFailures job={job} stepKey="video" />
        )}

        {!jobLoading && !loadError && !isGenerating && !videoFailed && (
          <div className="video-empty">
            <p>No video was generated for this project.</p>
            {!studentView && (
              <Button variant="outline" onClick={() => void handleRegenerate()}>
                Generate Video
              </Button>
            )}
            <Button variant="outline" onClick={() => window.history.back()}>
              Go back
            </Button>
          </div>
        )}
      </div>
    )
  }

  const isComplete = Boolean(videoUrl)
  const isFailed = FAILED_STATUSES.has(status.toLowerCase())

  return (
    <div className="video-page">
      <nav className="video-breadcrumb" aria-label="Breadcrumb">
        <Link to={projectRoute(id)}>{projectName}</Link>
        <span aria-hidden="true">/</span>
        <span>Video</span>
      </nav>

      <header className="video-header">
        <h1>{projectName}</h1>
        <p className="video-subtitle">AI-generated lesson video</p>
      </header>

      {!isComplete && !isFailed && (
        <div className="video-progress">
          <Loader label={isGenerating ? generatingLabel : `Rendering video… (${status})`} />
          {progress != null && (
            <p className="video-progress-label">{Math.round(progress * 100)}% complete</p>
          )}
        </div>
      )}

      {error && (
        <div className="video-error" role="alert">
          {error}
        </div>
      )}

      {videoUrl && (
        <div className="video-player-wrap">
          <video className="video-player" src={videoUrl} controls playsInline />
        </div>
      )}

      <div className="video-actions">
        {!studentView && (
          <>
            <Button variant="outline" onClick={() => void handleDownload()} disabled={!isComplete || downloading}>
              {downloading ? 'Downloading…' : 'Download MP4'}
            </Button>
            <Button variant="outline" onClick={() => void handleRegenerate()} disabled={isGenerating}>
              {isGenerating ? 'Generating…' : 'Regenerate'}
            </Button>
          </>
        )}
      </div>

      <ProjectOutputNav
        projectId={id}
        activeOutput="video"
        projectName={projectName}
        sourceText={job?.sourceText}
        studentView={studentView}
        outlineOnly
      />
    </div>
  )
}

export default Video
