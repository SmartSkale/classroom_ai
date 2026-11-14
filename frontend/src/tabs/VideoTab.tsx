import { useEffect, useRef, useState } from 'react'
import {
  createVideoJob,
  fetchVideoBlob,
  fileToDataUrl,
  getVideoJob,
  type LessonOverviewStyle,
  type OpensourceAnimationPreset,
  type VideoJobStack,
} from '../api'
import { useSource } from '../source/SourceContext'
import { Button, Card, EmptyState, Field, Notice, PageHeader, Segmented } from '../components/ui'
import { SourceBar } from '../components/SourceBar'

type ClipLength = '4' | '8' | '12' | 'approx30'

const SOURCE_LABELS: Record<VideoJobStack, string> = {
  opensource: 'Local animation',
  openai: 'OpenAI Sora',
  pexels: 'Pexels stock video',
  lesson_overview: 'Narrated lesson overview',
}

export function VideoTab() {
  const s = useSource()
  const [videoSource, setVideoSource] = useState<VideoJobStack>('opensource')
  const [prompt, setPrompt] = useState('')
  const [clipLength, setClipLength] = useState<ClipLength>('4')
  const [soraModel, setSoraModel] = useState<'sora-2' | 'sora-2-pro'>('sora-2')
  const [animation, setAnimation] = useState<OpensourceAnimationPreset>('motion_plus')
  const [overviewText, setOverviewText] = useState('')
  const [overviewStyle, setOverviewStyle] = useState<LessonOverviewStyle>('explainer')
  const [pexelsBackground, setPexelsBackground] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fillBusy, setFillBusy] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const urlRef = useRef<string | null>(null)

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    urlRef.current = videoUrl
  }, [videoUrl])
  useEffect(() => {
    return () => {
      stopPoll()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const model =
    videoSource === 'opensource'
      ? animation === 'motion_plus'
        ? 'opensource-local-motion-plus'
        : 'opensource-local-animation'
      : videoSource === 'pexels'
        ? 'pexels-stock-video'
        : videoSource === 'lesson_overview'
          ? 'lesson-overview-explainer'
          : soraModel

  const fillFromSource = async () => {
    setFillBusy(true)
    setError(null)
    try {
      setOverviewText(await s.getContext())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setFillBusy(false)
    }
  }

  const generate = async () => {
    setError(null)
    if (videoSource === 'lesson_overview') {
      if (overviewText.trim().length < 120) {
        setError('The overview needs at least 120 characters of source text. Fill it from your source or paste more.')
        return
      }
    } else if (!prompt.trim()) {
      setError(videoSource === 'pexels' ? 'Add a few search keywords.' : 'Describe the clip in a few short sentences.')
      return
    }

    stopPoll()
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setVideoUrl(null)
    setBusy(true)
    setStatus('Starting…')
    try {
      let refUrl: string | null = null
      if (videoSource === 'openai' && s.mode === 'images' && s.files.length > 0) {
        refUrl = await fileToDataUrl(s.files[0])
      }
      const job = await createVideoJob({
        prompt: videoSource === 'lesson_overview' ? overviewText.trim().slice(0, 400) : prompt.trim(),
        seconds: clipLength === 'approx30' ? '12' : clipLength,
        model,
        size: null,
        input_reference_image_url: refUrl,
        chain_target_seconds: videoSource === 'pexels' || videoSource === 'lesson_overview' ? null : clipLength === 'approx30' ? 30 : null,
        stack: videoSource,
        opensource_animation: videoSource === 'opensource' ? animation : null,
        ...(videoSource === 'lesson_overview'
          ? {
              lesson_source_text: overviewText.trim(),
              lesson_overview_style: overviewStyle,
              output_language: s.outputLanguage,
              lesson_use_pexels_background: pexelsBackground,
              lesson_llm_stack: s.stack,
            }
          : {}),
      })
      setStatus(videoSource === 'lesson_overview' ? 'Writing and narrating the overview…' : 'Rendering…')

      /** Returns true once the job has finished, either with a clip or an error. */
      const tick = async (): Promise<boolean> => {
        try {
          const j = await getVideoJob(job.id)
          if (j.status === 'completed') {
            const blob = await fetchVideoBlob(job.id)
            setVideoUrl(URL.createObjectURL(blob))
            setBusy(false)
            setStatus(null)
            return true
          }
          if (j.status === 'failed') {
            setBusy(false)
            setStatus(null)
            setError(j.error?.message || 'Video generation failed.')
            return true
          }
          if (typeof j.progress === 'number') {
            setStatus(`Rendering… ${Math.round(j.progress)}%`)
          }
          return false
        } catch (e) {
          setBusy(false)
          setStatus(null)
          setError(e instanceof Error ? e.message : String(e))
          return true
        }
      }

      if (!(await tick())) {
        pollRef.current = setInterval(async () => {
          if (await tick()) stopPoll()
        }, job.id.startsWith('lovid_') ? 6000 : 4000)
      }
    } catch (e) {
      setBusy(false)
      setStatus(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const isOverview = videoSource === 'lesson_overview'

  return (
    <>
      <PageHeader
        title="Video"
        description="Make a short clip from a prompt, stock footage, or a narrated overview of your source. Renders can take a few minutes."
      />

      {videoSource === 'lesson_overview' && <SourceBar />}

      <Card title="Clip source">
        <div className="settings-row">
          <Field label="Source type">
            <select value={videoSource} onChange={(e) => setVideoSource(e.target.value as VideoJobStack)}>
              <option value="opensource">Local animation (no API credits)</option>
              <option value="openai">OpenAI Sora (generative)</option>
              <option value="pexels">Pexels stock video (PEXELS_API_KEY)</option>
              <option value="lesson_overview">Narrated lesson overview</option>
            </select>
          </Field>

          {videoSource !== 'pexels' && !isOverview && (
            <Field label="Length">
              <select value={clipLength} onChange={(e) => setClipLength(e.target.value as ClipLength)}>
                <option value="4">4 seconds</option>
                <option value="8">8 seconds</option>
                <option value="12">12 seconds</option>
                <option value="approx30">About 30 seconds</option>
              </select>
            </Field>
          )}

          {videoSource === 'openai' && (
            <Field label="Model">
              <select value={soraModel} onChange={(e) => setSoraModel(e.target.value as 'sora-2' | 'sora-2-pro')}>
                <option value="sora-2">Sora 2</option>
                <option value="sora-2-pro">Sora 2 Pro</option>
              </select>
            </Field>
          )}

          {videoSource === 'opensource' && (
            <Field label="Style">
              <select value={animation} onChange={(e) => setAnimation(e.target.value as OpensourceAnimationPreset)}>
                <option value="motion_plus">Motion+ (smoother, richer)</option>
                <option value="classic">Classic (lightweight)</option>
              </select>
            </Field>
          )}

          {isOverview && (
            <>
              <Field label="Overview length">
                <Segmented
                  label="Overview length"
                  value={overviewStyle}
                  onChange={setOverviewStyle}
                  options={[
                    { value: 'explainer', label: 'Explainer (~6 parts)' },
                    { value: 'brief', label: 'Brief (~4 parts)' },
                  ]}
                />
              </Field>
              <label className="toggle">
                <input type="checkbox" checked={pexelsBackground} onChange={(e) => setPexelsBackground(e.target.checked)} />
                <span>Stock image backgrounds (Pexels)</span>
              </label>
            </>
          )}
        </div>

        {isOverview ? (
          <>
            <div className="row-wrap">
              <Button variant="secondary" icon="sparkle" loading={fillBusy} onClick={fillFromSource}>
                Fill from source
              </Button>
              <span className="muted">Uses the source and lesson from the other tabs.</span>
            </div>
            <Field label="Source text" hint={`${overviewText.trim().length.toLocaleString()} characters · at least 120 needed`}>
              <textarea
                rows={10}
                value={overviewText}
                onChange={(e) => setOverviewText(e.target.value)}
                placeholder="Paste the material to narrate, or fill it from your source."
              />
            </Field>
          </>
        ) : (
          <Field
            label={videoSource === 'pexels' ? 'Search keywords' : 'Animation prompt'}
            hint={
              videoSource === 'pexels'
                ? 'Short keywords work best, e.g. “plant cell, science lab”.'
                : 'Short factual sentences work best, e.g. “Chloroplasts trap sunlight. Water splits.”'
            }
          >
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                videoSource === 'pexels'
                  ? 'plant cell, science lab, teacher explaining'
                  : 'Chloroplasts trap sunlight. Water splits. CO2 becomes sugar. Oxygen is released.'
              }
            />
          </Field>
        )}

        <div className="row-wrap">
          <Button icon="video" loading={busy} onClick={generate}>
            {busy ? status ?? 'Rendering…' : isOverview ? 'Build overview video' : `Generate with ${SOURCE_LABELS[videoSource]}`}
          </Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        {videoSource === 'opensource' && (
          <p className="muted">Local clips are 2D lesson-style animations. For photoreal generative video, choose OpenAI Sora.</p>
        )}
        {videoSource === 'pexels' && (
          <p className="muted">Returns one landscape clip from the Pexels catalog. Follow Pexels license terms for your use.</p>
        )}
        {isOverview && (
          <p className="muted">
            The server writes a script with your language model, narrates each part, renders title slides, and stitches an MP4.
          </p>
        )}
      </Card>

      {!videoUrl && !busy && (
        <Card>
          <EmptyState icon="video" title="No clip yet">
            Your finished video plays here and can be downloaded.
          </EmptyState>
        </Card>
      )}

      {videoUrl && (
        <Card title="Your clip" actions={<a className="btn btn-secondary" href={videoUrl} download="classroomai-clip.mp4"><span>Download</span></a>}>
          <video className="video-player" src={videoUrl} controls playsInline />
        </Card>
      )}
    </>
  )
}
