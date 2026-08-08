import { useState } from 'react'
import { Button } from '../Button'
import type { GenerationJob } from '../../context/generation-context'
import {
  countReadyOutputs,
  downloadProjectBundle,
  type BundleResult,
} from '../../utils/downloadProjectBundle'
import './DownloadAllButton.css'

interface DownloadAllButtonProps {
  job: GenerationJob | undefined
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  /** Hide status hint — use in toolbars where hint would break button alignment. */
  compact?: boolean
  onComplete?: (result: BundleResult) => void
  onError?: (message: string) => void
}

export function DownloadAllButton({
  job,
  variant = 'primary',
  size = 'sm',
  fullWidth = false,
  compact = false,
  onComplete,
  onError,
}: DownloadAllButtonProps) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const readyCount = job ? countReadyOutputs(job) : 0
  const disabled = !job || readyCount === 0 || loading

  async function handleClick() {
    if (!job) return
    setLoading(true)
    setProgress('Starting…')
    try {
      const result = await downloadProjectBundle(job, (p) => {
        setProgress(`${p.label} (${p.current}/${p.total})`)
      })
      onComplete?.(result)
    } catch {
      onError?.('Could not build the download package. Please try again.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const label = loading ? 'Preparing ZIP…' : 'Download All Materials'

  if (compact) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => void handleClick()}
        title={progress ?? undefined}
      >
        {label}
      </Button>
    )
  }

  return (
    <div className={`download-all${fullWidth ? ' download-all-block' : ''}`}>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        disabled={disabled}
        onClick={() => void handleClick()}
      >
        {loading ? 'Preparing ZIP…' : 'Download All Materials'}
      </Button>
      {progress && (
        <p className="download-all-progress" role="status">
          {progress}
        </p>
      )}
      {job && !loading && readyCount > 0 && (
        <p className="download-all-hint">
          {readyCount} of {job.outputs.length} outputs ready
        </p>
      )}
    </div>
  )
}

export default DownloadAllButton
