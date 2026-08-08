import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import { formatSessionCountdown } from '../../utils/jwt'
import './SessionTimeoutModal.css'

function AlarmClockIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="28" cy="30" r="18" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M18 14 L22 18 M38 14 L34 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 30 L28 22"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 30 L34 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface SessionTimeoutModalProps {
  open: boolean
  expired: boolean
  resetError: boolean
  remainingMs: number
  refreshing: boolean
  onReset: () => void
  onClose: () => void
}

export function SessionTimeoutModal({
  open,
  expired,
  resetError,
  remainingMs,
  refreshing,
  onReset,
  onClose,
}: SessionTimeoutModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Session Timeout"
      className="session-timeout-modal"
    >
      <div className="session-timeout-content">
        <div className="session-timeout-icon">
          <AlarmClockIcon />
        </div>
        {expired ? (
          <>
            <p className="session-timeout-message">Your session expired due to inactivity.</p>
            <p className="session-timeout-submessage">
              {resetError
                ? 'Could not extend your session. Click Reset to try again.'
                : 'Click Reset to sign in again and stay on this page.'}
            </p>
            <div className="session-timeout-actions">
              <Button
                variant="outline"
                className="session-timeout-reset"
                onClick={onReset}
                disabled={refreshing}
              >
                {refreshing ? 'Resetting…' : 'Reset'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="session-timeout-message">You&apos;ve been inactive. Your session will expire soon.</p>
            <p className="session-timeout-countdown" aria-live="polite">
              {formatSessionCountdown(remainingMs)}
            </p>
            <div className="session-timeout-actions">
              <Button
                variant="outline"
                className="session-timeout-reset"
                onClick={onReset}
                disabled={refreshing}
              >
                {refreshing ? 'Resetting…' : 'Reset'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default SessionTimeoutModal
