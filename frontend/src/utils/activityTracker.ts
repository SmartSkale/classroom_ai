type ActivityListener = () => void

let lastActivityAt = Date.now()
const listeners: ActivityListener[] = []
let trackingInitialized = false

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
]

function notifyListeners() {
  for (const listener of listeners) listener()
}

/** Record user activity (resets the inactivity timer). */
export function recordActivity() {
  lastActivityAt = Date.now()
  notifyListeners()
}

/** Milliseconds since the last recorded activity. */
export function getInactiveMs(): number {
  return Date.now() - lastActivityAt
}

/** Subscribe to activity events; returns an unsubscribe function. */
export function subscribeToActivity(listener: ActivityListener): () => void {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

/** Attach global listeners for user interaction (once). */
export function initActivityTracking() {
  if (trackingInitialized) return
  trackingInitialized = true

  const onActivity = () => recordActivity()

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, onActivity, { passive: true })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onActivity()
  })

  recordActivity()
}
