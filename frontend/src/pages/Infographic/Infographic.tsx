import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { Button } from '../../components/Button'
import { Loader } from '../../components/Loader'
import { ProjectOutputNav } from '../../components/ProjectOutputNav'
import { useGeneration } from '../../context/generation-context'
import { generationService } from '../../services/generationService'
import {
  INFOGRAPHIC_COLORS,
  INFOGRAPHIC_LAYOUTS,
  ROUTES,
  type InfographicColorId,
  type InfographicLayoutId,
} from '../../utils/constants'
import './Infographic.css'

interface Toast {
  type: 'success' | 'error'
  message: string
}

const GENERATE_ERROR = 'Infographic generation failed. Try a different layout.'

function slugify(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'infographic'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function Infographic() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { jobs, cacheResults } = useGeneration()
  const job = jobs[id]
  const navState = location.state as { name?: string; text?: string } | null

  const projectName = job?.name ?? navState?.name ?? 'Your Project'
  const sourceText = job?.sourceText ?? navState?.text ?? ''
  const outputLanguage = job?.outputLanguage ?? 'english'
  const cached = job?.results.infographic ?? null

  const [layout, setLayout] = useState<InfographicLayoutId>(INFOGRAPHIC_LAYOUTS[0].id)
  const [color, setColor] = useState<InfographicColorId>(INFOGRAPHIC_COLORS[0].id)

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
      const layoutPrompt = INFOGRAPHIC_LAYOUTS.find((l) => l.id === layout)?.prompt
      const colorPrompt = INFOGRAPHIC_COLORS.find((c) => c.id === color)?.prompt
      const result = await generationService.generateInfographic(projectName, sourceText, {
        layoutPrompt,
        colorPrompt,
        outputLanguage,
      })
      cacheResults(id, { infographic: result })
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
      a.download = `${slugify(projectName)}-infographic.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast({ type: 'success', message: 'Infographic PNG downloaded.' })
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
      doc.save(`${slugify(projectName)}-infographic.pdf`)
      showToast({ type: 'success', message: 'Infographic PDF downloaded.' })
    } catch {
      showToast({ type: 'error', message: 'Could not generate PDF. Please try again.' })
    }
  }

  return (
    <div className="infographic">
      <nav className="infographic-breadcrumb" aria-label="Breadcrumb">
        <Link to={ROUTES.dashboard}>{projectName}</Link>
        <span aria-hidden="true">›</span>
        <span className="infographic-breadcrumb-current">Infographic</span>
      </nav>

      <section className="infographic-settings" aria-label="Infographic settings">
        <label className="infographic-control">
          <span>Layout</span>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as InfographicLayoutId)}
            disabled={loading}
            required
          >
            {INFOGRAPHIC_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="infographic-control">
          <span>Color</span>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value as InfographicColorId)}
            disabled={loading}
            required
          >
            {INFOGRAPHIC_COLORS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <div className="infographic-error-box" role="alert">
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <Loader label="Generating infographic…" />
        ) : (
          <Button variant="primary" size="lg" onClick={handleGenerate}>
            {image ? 'Regenerate' : 'Generate Infographic'}
          </Button>
        )}
      </section>

      {image && !loading && (
        <section className="infographic-result" aria-label="Infographic preview">
          <div className="infographic-preview">
            <img src={image} alt={`${projectName} infographic`} />
          </div>
          <div className="infographic-actions">
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
        activeOutput="infographic"
        projectName={projectName}
        sourceText={sourceText}
      />

      {toast && (
        <div className={`infographic-toast infographic-toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default Infographic
