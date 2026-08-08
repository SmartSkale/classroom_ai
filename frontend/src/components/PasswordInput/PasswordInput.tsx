import { useState, type InputHTMLAttributes } from 'react'
import './PasswordInput.css'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg className="password-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    )
  }

  return (
    <svg className="password-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M10.6 10.6A2.5 2.5 0 0 0 12 15a2.5 2.5 0 0 0 1.4-.4M7.2 7.2C8.6 6.3 10.2 6 12 6c5.5 0 9 6 9 6a15.5 15.5 0 0 1-3.1 3.8M5.1 9.1C4.1 10 3 12 3 12s3.5 6 9 6c.9 0 1.7-.1 2.5-.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={`password-input-wrap${className ? ` ${className}` : ''}`}>
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisible((show) => !show)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        <EyeIcon hidden={!visible} />
      </button>
    </div>
  )
}

export default PasswordInput
