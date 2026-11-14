import { useState } from 'react'
import { useSource } from '../source/SourceContext'
import { Button } from './ui'
import { Icon } from './icons'
import { SourcePanel } from './SourcePanel'

/** Compact source summary shown on every generation tab. Expands into the full editor. */
export function SourceBar() {
  const s = useSource()
  const [open, setOpen] = useState(false)
  const showEditor = open || !s.hasSource

  return (
    <div className="source-bar">
      <div className="source-bar-row">
        <span className="source-bar-icon">
          <Icon name="source" size={18} />
        </span>
        <div className="source-bar-text">
          <strong>{s.sourceLabel}</strong>
          <span className="muted">Topic: {s.topic}</span>
        </div>
        {s.hasSource && (
          <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide source' : 'Edit source'}
          </Button>
        )}
      </div>
      {showEditor && (
        <div className="source-bar-editor">
          {!s.hasSource && <p className="muted">Add a source to get started. Paste text, upload a PDF, or add screenshots.</p>}
          <SourcePanel />
        </div>
      )}
    </div>
  )
}
