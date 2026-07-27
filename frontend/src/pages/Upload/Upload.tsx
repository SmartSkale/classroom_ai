import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../hooks/useAuth'
import { useGeneration } from '../../context/generation-context'
import { canCreateContent } from '../../utils/roles'
import explanationService from '../../services/explanationService'
import {
  ACCEPTED_FILE_EXTENSIONS,
  DEFAULT_OUTPUT_TYPES,
  MAX_FILE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TEXT_LENGTH,
  OUTPUT_LANGUAGES,
  OUTPUT_TYPES,
  PDF_DOCUMENT_TYPES,
  PDF_HANDWRITTEN_TYPED_MISMATCH_ERROR,
  PDF_PRINTED_HANDWRITTEN_MISMATCH_ERROR,
  PROJECT_NAME_MAX,
  PROJECT_NAME_MIN,
  ROUTES,
  type OutputLanguageId,
  type OutputTypeId,
  type PdfDocumentTypeId,
} from '../../utils/constants'
import './Upload.css'

const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.docx'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPdfFile(file: File): boolean {
  return explanationService.isPdfFile(file)
}

function isImageFile(file: File): boolean {
  return explanationService.isImageFile(file)
}

function validateFiles(selected: File[]): string | null {
  if (selected.length === 0) return null

  const hasPdf = selected.some((f) => isPdfFile(f))
  const hasImage = selected.some((f) => isImageFile(f))

  if (hasPdf && hasImage) {
    return 'Upload either one PDF or multiple images, not both.'
  }
  if (hasPdf && selected.length > 1) {
    return 'Only one PDF can be uploaded at a time.'
  }
  if (hasImage && selected.length > MAX_IMAGE_COUNT) {
    return `You can upload up to ${MAX_IMAGE_COUNT} images at a time.`
  }

  for (const file of selected) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_FILE_EXTENSIONS.includes(ext as (typeof ACCEPTED_FILE_EXTENSIONS)[number])) {
      return `Unsupported file type: ${file.name}`
    }
    if (file.size > MAX_FILE_BYTES) {
      return `File too large (max 50MB): ${file.name}`
    }
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

  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [text, setText] = useState('')
  const [outputs, setOutputs] = useState<OutputTypeId[]>(DEFAULT_OUTPUT_TYPES)
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguageId>(OUTPUT_LANGUAGES[0].id)
  const [pdfDocumentType, setPdfDocumentType] = useState<PdfDocumentTypeId>('printed')
  const [projectName, setProjectName] = useState('')
  const [errors, setErrors] = useState<{
    content?: string
    outputs?: string
    name?: string
    pdfType?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)

  const hasPdf = files.some((f) => isPdfFile(f))
  const hasImages = files.some((f) => isImageFile(f))

  async function validatePdfDocumentTypeSelection(
    pdfFile: File | undefined,
    selectedType: PdfDocumentTypeId,
  ): Promise<boolean> {
    if (!pdfFile) {
      setErrors((e) => ({ ...e, pdfType: undefined }))
      return true
    }

    try {
      const { looks_printed, looks_handwritten } = await explanationService.detectPdfType(pdfFile)
      if (selectedType === 'handwritten' && looks_printed) {
        setErrors((e) => ({ ...e, pdfType: PDF_HANDWRITTEN_TYPED_MISMATCH_ERROR }))
        return false
      }
      if (selectedType === 'printed' && looks_handwritten) {
        setErrors((e) => ({ ...e, pdfType: PDF_PRINTED_HANDWRITTEN_MISMATCH_ERROR }))
        return false
      }
      setErrors((e) => ({ ...e, pdfType: undefined }))
      return true
    } catch {
      setErrors((e) => ({
        ...e,
        pdfType: 'Could not verify PDF type. Please try again.',
      }))
      return false
    }
  }

  function acceptFiles(incoming: FileList | File[] | null | undefined) {
    if (!incoming || incoming.length === 0) return

    const selected = Array.from(incoming)
    const err = validateFiles(selected)
    if (err) {
      setFileError(err)
      setUploadSuccess(null)
      return
    }

    setFileError(null)

    if (selected.some((f) => isPdfFile(f))) {
      const pdfFile = selected[0]
      setFiles([pdfFile])
      setUploadSuccess('File uploaded successfully.')
      setErrors((e) => ({ ...e, content: undefined, pdfType: undefined }))
      void validatePdfDocumentTypeSelection(pdfFile, pdfDocumentType)
      return
    }

    const imageOnly = selected.filter((f) => isImageFile(f))
    if (imageOnly.length === 0) {
      setFileError('Unsupported file type.')
      setUploadSuccess(null)
      return
    }

    const merged = [...files, ...imageOnly]
    const mergeErr = validateFiles(merged)
    if (mergeErr) {
      setFileError(mergeErr)
      setUploadSuccess(null)
      return
    }
    setFiles(merged)
    setUploadSuccess(
      imageOnly.length === 1
        ? 'File uploaded successfully.'
        : `${imageOnly.length} files uploaded successfully.`,
    )
    setErrors((e) => ({ ...e, content: undefined }))
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setFileError(null)
    setUploadSuccess(null)
    setErrors((e) => ({ ...e, pdfType: undefined }))
  }

  function clearFiles() {
    setFiles([])
    setFileError(null)
    setUploadSuccess(null)
    setErrors((e) => ({ ...e, pdfType: undefined }))
  }

  function onBrowse(e: ChangeEvent<HTMLInputElement>) {
    acceptFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    acceptFiles(e.dataTransfer.files)
  }

  function toggleOutput(id: OutputTypeId) {
    setOutputs((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id],
    )
    setErrors((e) => ({ ...e, outputs: undefined }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const nextErrors: typeof errors = {}
    const trimmedName = projectName.trim()

    if (files.length === 0 && !text.trim()) {
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

    setSubmitting(true)
    const pdfFile = files.find((f) => isPdfFile(f))
    const pdfTypeOk = await validatePdfDocumentTypeSelection(pdfFile, pdfDocumentType)
    if (!pdfTypeOk) {
      setSubmitting(false)
      return
    }

    setErrors({})
    const jobId = startGeneration({
      name: trimmedName,
      text: text.trim() || undefined,
      files: files.length > 0 ? files : undefined,
      outputs,
      outputLanguage,
      documentType: hasPdf ? pdfDocumentType : undefined,
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
          {files.length > 0 ? (
            <div className="dropzone-files">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="dropzone-file">
                  <span className="dropzone-file-icon" aria-hidden="true">
                    {isPdfFile(file) ? '📄' : '🖼️'}
                  </span>
                  <div className="dropzone-file-info">
                    <strong>{file.name}</strong>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="dropzone-remove"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {hasImages && (
                <div className="dropzone-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                  >
                    Add more images
                  </Button>
                  <button type="button" className="dropzone-clear" onClick={clearFiles}>
                    Clear all
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <span className="dropzone-icon" aria-hidden="true">
                ⬆️
              </span>
              <p className="dropzone-text">Drag &amp; drop a PDF or images here</p>
              <p className="dropzone-or">or</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Browse Files
              </Button>
              <p className="dropzone-hint">
                Max 50MB per file · PDF or multiple PNG/JPG screenshots (up to {MAX_IMAGE_COUNT})
              </p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple={!hasPdf}
            className="dropzone-input"
            onChange={onBrowse}
          />
        </div>
        {fileError && <p className="upload-error">{fileError}</p>}
        {uploadSuccess && !fileError && (
          <p className="upload-success" role="status">
            {uploadSuccess}
          </p>
        )}

        <fieldset className={`upload-pdf-type${errors.pdfType ? ' upload-pdf-type-error' : ''}`}>
          <legend>PDF type</legend>
          <div className="upload-pdf-type-options">
            {PDF_DOCUMENT_TYPES.map((option) => (
              <label key={option.id} className="upload-radio">
                <input
                  type="radio"
                  name="pdf-document-type"
                  value={option.id}
                  checked={pdfDocumentType === option.id}
                  onChange={() => {
                    setPdfDocumentType(option.id)
                    const pdfFile = files.find((f) => isPdfFile(f))
                    void validatePdfDocumentTypeSelection(pdfFile, option.id)
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <p className="upload-pdf-type-hint">
            Handwritten notes use local OCR (Tesseract) and may take longer on large scans.
            English handwriting only.
          </p>
          {errors.pdfType && <p className="upload-error">{errors.pdfType}</p>}
        </fieldset>

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

        <label className="upload-field upload-language">
          <span className="upload-label">Output language</span>
          <select
            value={outputLanguage}
            onChange={(e) => setOutputLanguage(e.target.value as OutputLanguageId)}
          >
            {OUTPUT_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
          <span className="upload-language-hint">
            All selected outputs will be generated in this language.
          </span>
        </label>

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
