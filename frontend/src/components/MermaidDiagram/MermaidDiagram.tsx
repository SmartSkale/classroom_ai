import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'
import './MermaidDiagram.css'

let initialized = false
function ensureInit() {
  if (initialized) return
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
  initialized = true
}

interface RenderState {
  svg: string | null
  failed: boolean
  key: string
}

export function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [state, setState] = useState<RenderState>({ svg: null, failed: false, key: '' })

  useEffect(() => {
    let cancelled = false
    const renderId = `mmd-${rawId}`
    const source = code.trim()

    // On a parse/render failure, mermaid v11 appends temporary measuring nodes
    // (and its "Syntax error" graphic) to <body>. Remove any that leak through.
    function cleanupOrphans() {
      for (const sel of [`#${renderId}`, `#d${renderId}`]) {
        document.querySelectorAll(sel).forEach((el) => el.remove())
      }
    }

    async function run() {
      ensureInit()
      try {
        // Validate first. `suppressErrors` makes parse return false on invalid
        // input instead of throwing AND prevents mermaid from injecting its
        // error diagram into the DOM, so a bad diagram never shows the bomb.
        const valid = await mermaid.parse(source, { suppressErrors: true })
        if (!valid) {
          cleanupOrphans()
          if (!cancelled) setState({ svg: null, failed: true, key: code })
          return
        }
        const { svg } = await mermaid.render(renderId, source)
        if (!cancelled) setState({ svg, failed: false, key: code })
      } catch {
        cleanupOrphans()
        if (!cancelled) setState({ svg: null, failed: true, key: code })
      }
    }

    void run()
    return () => {
      cancelled = true
      cleanupOrphans()
    }
  }, [code, rawId])

  const isCurrent = state.key === code
  if (isCurrent && state.failed) {
    return (
      <pre className="mermaid-fallback">
        <code>{code}</code>
      </pre>
    )
  }
  if (!isCurrent || !state.svg) return null
  return <div className="mermaid-wrap" dangerouslySetInnerHTML={{ __html: state.svg }} />
}

export default MermaidDiagram
