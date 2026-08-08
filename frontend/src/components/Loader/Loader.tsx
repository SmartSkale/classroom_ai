import './Loader.css'

interface LoaderProps {
  label?: string
  fullscreen?: boolean
}

export function Loader({ label = 'Loading…', fullscreen = false }: LoaderProps) {
  return (
    <div className={fullscreen ? 'loader loader-fullscreen' : 'loader'} role="status">
      <span className="loader-spinner" aria-hidden="true" />
      <span className="loader-label">{label}</span>
    </div>
  )
}

export default Loader
