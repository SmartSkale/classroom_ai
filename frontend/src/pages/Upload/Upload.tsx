import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { useGeneration } from '../../context/generation-context'
import { canCreateContent } from '../../utils/roles'
import {
  ACCEPTED_FILE_EXTENSIONS,
  DEFAULT_OUTPUT_TYPES,
  MAX_FILE_BYTES,
  MAX_TEXT_LENGTH,
  OUTPUT_TYPES,
  PROJECT_NAME_MAX,
  PROJECT_NAME_MIN,
  ROUTES,
  type OutputTypeId,
} from '../../utils/constants'
import './Upload.css'

const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.docx'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ACCEPTED_FILE_EXTENSIONS.includes(ext as (typeof ACCEPTED_FILE_EXTENSIONS)[number])) {
    return 'Unsupported file type.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File too large (max 50MB).'
  }
  return null
}

export function Upload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { startGeneration } = useGeneration()
  const inputRef = useRef<HTMLInputElement>(null)

  if (!canCreateContent(user)) {
    return <Navigate to={ROUTES.dashboard} replace />
  }

  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [text, setText] = useState('')
  const [outputs, setOutputs] = useState<OutputTypeId[]>(DEFAULT_OUTPUT_TYPES)
  const [projectName, setProjectName] = useState('')
  const [errors, setErrors] = useState<{
    content?: string
    outputs?: string
    name?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)

  function acceptFile(selected: File | undefined | null) {
    if (!selected) return
    const err = validateFile(selected)
    if (err) {
      setFileError(err)
      setFile(null)
      return
    }
    setFileError(null)
    setFile(selected)
    setErrors((e) => ({ ...e, content: undefined }))
  }

  function onBrowse(e: ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0])
  }

  function toggleOutput(id: OutputTypeId) {
    setOutputs((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    )
    setErrors((e) => ({ ...e, outputs: undefined }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const nextErrors: typeof errors = {}
    const trimmedName = projectName.trim()

    if (!file && !text.trim()) {
      nextErrors.content = 'No content provided.'
    }
    if (outputs.length === 0) {
      nextErrors.outputs = 'Please select at least one output type.'
    }
    if (trimmedName.length < PROJECT_NAME_MIN || trimmedName.length > PROJECT_NAME_MAX) {
      nextErrors.name = `Project name must be ${PROJECT_NAME_MIN}–${PROJECT_NAME_MAX} characters.`
    }

    if (fileError || Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    // Kick off the real backend generation for every selected output now, then
    // watch its progress on the Processing screen.
    const jobId = startGeneration({
      name: trimmedName,
      text: text.trim() || undefined,
      file,
      outputs,
    })
    navigate(ROUTES.processing, { state: { jobId } })
  }

  return (
    <div className="upload">
      <h1 className="upload-title">Upload Your Content</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div
          className={`dropzone ${dragOver ? 'dropzone-active' : ''} ${
            fileError ? 'dropzone-error' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {file ? (
            <div className="dropzone-file">
              <span className="dropzone-file-icon" aria-hidden="true">
                📄
              </span>
              <div className="dropzone-file-info">
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                className="dropzone-remove"
                onClick={() => setFile(null)}
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <span className="dropzone-icon" aria-hidden="true">
                ⬆️
              </span>
              <p className="dropzone-text">Drag &amp; drop PDF or image here</p>
              <p className="dropzone-or">or</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Browse Files
              </Button>
              <p className="dropzone-hint">Max 50MB · PDF, PNG, JPG, DOCX</p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="dropzone-input"
            onChange={onBrowse}
          />
        </div>
        {fileError && <p className="upload-error">{fileError}</p>}

        <div className="upload-divider">
          <span>OR paste text below</span>
        </div>

        <label className="upload-field">
          <textarea
            className="upload-textarea"
            value={text}
            maxLength={MAX_TEXT_LENGTH}
            placeholder="Paste a chapter or notes here…"
            onChange={(e) => {
              setText(e.target.value)
              setErrors((er) => ({ ...er, content: undefined }))
            }}
          />
          <span className="upload-counter">
            {text.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
          </span>
        </label>
        {errors.content && <p className="upload-error">{errors.content}</p>}

        <fieldset className="upload-outputs">
          <legend>Select Output Types</legend>
          <div className="upload-outputs-grid">
            {OUTPUT_TYPES.map((type) => (
              <label key={type.id} className="upload-checkbox">
                <input
                  type="checkbox"
                  checked={outputs.includes(type.id)}
                  onChange={() => toggleOutput(type.id)}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
          {errors.outputs && <p className="upload-error">{errors.outputs}</p>}
        </fieldset>

        <label className="upload-field upload-name">
          <span className="upload-label">Project Name</span>
          <input
            type="text"
            value={projectName}
            maxLength={PROJECT_NAME_MAX}
            placeholder="e.g. Chapter 3 — Photosynthesis"
            onChange={(e) => {
              setProjectName(e.target.value)
              setErrors((er) => ({ ...er, name: undefined }))
            }}
          />
          {errors.name && <p className="upload-error">{errors.name}</p>}
        </label>

        <div className="upload-submit">
          <Button type="submit" variant="primary" size="lg" disabled={submitting}>
            {submitting ? 'Starting…' : 'Generate Now'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default Upload
