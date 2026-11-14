import { useState, type ChangeEvent } from 'react'
import { OUTPUT_LANGUAGE_LABELS } from '../api'
import { useSource } from '../source/SourceContext'
import type { SourceMode } from '../source/SourceContext'
import { Button, Field, Notice, Segmented } from './ui'
import { Icon } from './icons'

function FileDrop({
  accept,
  multiple = false,
  files,
  onChange,
  title,
  hint,
}: {
  accept: string
  multiple?: boolean
  files: File[]
  onChange: (files: File[]) => void
  title: string
  hint: string
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.files ? Array.from(e.target.files) : [])
  return (
    <label className="file-drop">
      <input type="file" accept={accept} multiple={multiple} onChange={handle} />
      <Icon name="upload" size={26} />
      <strong>{files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} selected` : title}</strong>
      <span>{files.length > 0 ? files.map((f) => f.name).join(', ') : hint}</span>
    </label>
  )
}

const MODE_OPTIONS: { value: SourceMode; label: string }[] = [
  { value: 'text', label: 'Chapter text' },
  { value: 'pdf', label: 'PDF chapter' },
  { value: 'images', label: 'Screenshots' },
]

/** The full source editor. Lives on the Lesson tab and expands from the source bar elsewhere. */
export function SourcePanel() {
  const s = useSource()
  const [error, setError] = useState<string | null>(null)
  const [readDone, setReadDone] = useState(false)

  const readSource = async () => {
    setError(null)
    setReadDone(false)
    try {
      await s.prepareLesson()
      setReadDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const needsRead = s.mode === 'pdf' || s.mode === 'images'

  return (
    <div className="stack">
      <Segmented options={MODE_OPTIONS} value={s.mode} onChange={s.setMode} label="Source type" />

      <Field label="Topic focus (optional)" hint="Narrow the output to one section, e.g. “concave mirrors only”.">
        <input
          value={s.topicHint}
          onChange={(e) => s.setTopicHint(e.target.value)}
          placeholder="Leave empty to use the whole source"
        />
      </Field>

      {s.mode === 'text' && (
        <Field
          label="Chapter text"
          hint={`${s.chapterText.trim().length.toLocaleString()} characters · paste the full section for best results`}
        >
          <textarea
            value={s.chapterText}
            onChange={(e) => s.setChapterText(e.target.value)}
            rows={9}
            placeholder={`Paste chapter text here. Every tab will work from it in ${OUTPUT_LANGUAGE_LABELS[s.outputLanguage]}.`}
          />
        </Field>
      )}

      {s.mode === 'pdf' && (
        <div className="stack">
          <FileDrop
            accept="application/pdf,.pdf"
            files={s.pdfFile ? [s.pdfFile] : []}
            onChange={(f) => s.setPdfFile(f[0] ?? null)}
            title="Choose a PDF"
            hint="Up to 100 pages and 40 MB"
          />
          <div className="toggle-row">
            <label className="toggle">
              <input type="checkbox" checked={s.pdfOcrPages} onChange={(e) => s.setPdfOcrPages(e.target.checked)} />
              <span>OCR scanned pages</span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={s.pdfOcrImages} onChange={(e) => s.setPdfOcrImages(e.target.checked)} />
              <span>OCR text inside images</span>
            </label>
          </div>
        </div>
      )}

      {s.mode === 'images' && (
        <FileDrop
          accept="image/*"
          multiple
          files={s.files}
          onChange={s.setFiles}
          title="Choose screenshots"
          hint="PNG or JPEG photos of the textbook pages"
        />
      )}

      {needsRead && (
        <div className="row-wrap">
          <Button variant="secondary" icon="sparkle" loading={s.lessonBusy} disabled={!s.hasSource} onClick={readSource}>
            {s.lessonBusy ? 'Reading source…' : s.lesson ? 'Read again' : 'Read source'}
          </Button>
          <span className="muted">
            Reading turns {s.mode === 'pdf' ? 'the PDF' : 'the screenshots'} into text that every tab can use.
          </span>
        </div>
      )}

      {readDone && <Notice tone="success">Source read. Every tab can now generate from it.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
