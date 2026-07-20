import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { generationService } from '../../services/generationService'
import { ROUTES } from '../../utils/constants'
import './Illustration.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

const GENERATE_ERROR = 'Illustration generation failed. Please try again.'

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'illustration'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function Illustration() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { jobs, cacheResults } = useGeneration()
  const job = jobs[id]
  const navState = location.state as { name?: string; text?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text ?? ''
  const outputLanguage = job?.outputLanguage ?? 'english'
  const cached = job?.results.illustration ?? null

  const [image, setImage] = useState<string | null>(cached?.dataUrl ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((t: Toast) => {
    setToast(t)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3000)
  }, [])

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generationService.generateIllustration(projectName, sourceText, {
        outputLanguage,
      })
      cacheResults(id, { illustration: result })
      setImage(result.dataUrl)
    } catch {
      setError(GENERATE_ERROR)
    } finally {
      setLoading(false)
    }
  }

  function handleDownloadPng() {
    if (!image) return
    try {
      const a = document.createElement('a')
      a.href = image
      a.download = `${slugify(projectName)}-illustration.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast({ type: 'success', message: 'Illustration PNG downloaded.' })
    } catch {
      showToast({ type: 'error', message: 'Could not download PNG. Please try again.' })
    }
  }

  async function handleDownloadPdf() {
    if (!image) return
    try {
      const img = await loadImage(image)
      const orientation = img.width >= img.height ? 'landscape' : 'portrait'
      const doc = new jsPDF({ unit: 'pt', orientation, format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 32
      const maxW = pageW - margin * 2
      const maxH = pageH - margin * 2
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio
      const x = (pageW - w) / 2
      const y = (pageH - h) / 2
      doc.addImage(image, 'PNG', x, y, w, h)
      doc.save(`${slugify(projectName)}-illustration.pdf`)
      showToast({ type: 'success', message: 'Illustration PDF downloaded.' })
    } catch {
      showToast({ type: 'error', message: 'Could not generate PDF. Please try again.' })
    }
  }

  return (
    <div className="illustration-page">
      <nav className="illustration-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="illustration-breadcrumb-current">Illustration</span>
      </nav>

      <section className="illustration-settings" aria-label="Illustration settings">
        <p className="illustration-hint">
          Generates a textbook-style scene for this lesson — separate from the infographic poster.
        </p>

        {error && (
          <div className="illustration-error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <Loader label="Generating illustration…" />
        ) : (
          <Button variant="primary" size="lg" onClick={handleGenerate}>
            {image ? 'Regenerate' : 'Generate Illustration'}
          </Button>
        )}
      </section>

      {image && !loading && (
        <section className="illustration-result" aria-label="Illustration preview">
          <div className="illustration-preview">
            <img src={image} alt={`${projectName} illustration`} />
          </div>
          <div className="illustration-actions">
            <Button variant="primary" onClick={handleDownloadPng}>
              Download PNG
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf}>
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleGenerate}>
              Regenerate
            </Button>
          </div>
        </section>
      )}

      <ProjectOutputNav
        projectId={id}
        activeOutput="illustration"
        projectName={projectName}
        sourceText={sourceText}
      />

      {toast && (
        <div className={`illustration-toast illustration-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Illustration
