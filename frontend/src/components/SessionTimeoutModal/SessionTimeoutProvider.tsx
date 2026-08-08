import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_WARNING_MS,
} from '../../utils/constants'
import {
  getInactiveMs,
  initActivityTracking,
  recordActivity,
  subscribeToActivity,
} from '../../utils/activityTracker'
import { getTokenExpiresInMs } from '../../utils/jwt'
import { SessionTimeoutModal } from '../SessionTimeoutModal/SessionTimeoutModal'

/** Refresh JWT while the user is active and the token is close to expiring. */
const SILENT_REFRESH_THRESHOLD_MS = 2 * 60 * 1000
const ACTIVE_USER_MS = 60 * 1000

function getInactiveRemainingMs(): number {
  return Math.max(0, SESSION_INACTIVITY_TIMEOUT_MS - getInactiveMs())
}

export function SessionTimeoutProvider() {
  const { token, status, refreshSession } = useAuth()
  const [open, setOpen] = useState(false)
  const [expired, setExpired] = useState(false)
  const [remainingMs, setRemainingMs] = useState(SESSION_INACTIVITY_TIMEOUT_MS)
  const [refreshing, setRefreshing] = useState(false)
  const [resetError, setResetError] = useState(false)

  const dismissedRef = useRef(false)
  const expiryHandledRef = useRef(false)
  const silentRefreshInFlightRef = useRef(false)

  const markSessionExpired = useCallback(() => {
    if (expiryHandledRef.current) return
    expiryHandledRef.current = true
    setExpired(true)
    setOpen(true)
    setResetError(false)
    dismissedRef.current = false
    setRemainingMs(0)
  }, [])

  const evaluateSession = useCallback(() => {
    const inactiveRemaining = getInactiveRemainingMs()
    setRemainingMs(inactiveRemaining)

    if (inactiveRemaining <= 0) {
      markSessionExpired()
      return
    }

    if (inactiveRemaining <= SESSION_WARNING_MS) {
      if (!dismissedRef.current && !expiryHandledRef.current) {
        setOpen(true)
      }
    } else {
      setOpen(false)
      dismissedRef.current = false
      if (expiryHandledRef.current) {
        expiryHandledRef.current = false
        setExpired(false)
        setResetError(false)
      }
    }
  }, [markSessionExpired])

  const maybeSilentRefresh = useCallback(async () => {
    if (!token || status !== 'authenticated') return
    if (silentRefreshInFlightRef.current) return
    if (getInactiveMs() > ACTIVE_USER_MS) return

    const tokenRemaining = getTokenExpiresInMs(token)
    if (tokenRemaining <= 0 || tokenRemaining > SILENT_REFRESH_THRESHOLD_MS) return

    silentRefreshInFlightRef.current = true
    try {
      await refreshSession()
    } catch {
      // Ignore — the warning modal handles explicit refresh failures.
    } finally {
      silentRefreshInFlightRef.current = false
    }
  }, [token, status, refreshSession])

  useEffect(() => {
    initActivityTracking()
  }, [])

  useEffect(() => {
    dismissedRef.current = false
    expiryHandledRef.current = false
    setExpired(false)
    setResetError(false)
    setOpen(false)
    if (status === 'authenticated') {
      recordActivity()
    }
  }, [token, status])

  useEffect(() => {
    if (status !== 'authenticated' || !token) {
      setOpen(false)
      return
    }

    evaluateSession()
    void maybeSilentRefresh()

    const intervalId = window.setInterval(() => {
      evaluateSession()
      void maybeSilentRefresh()
    }, 1000)

    const unsubscribeActivity = subscribeToActivity(() => {
      evaluateSession()
      void maybeSilentRefresh()
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        evaluateSession()
        void maybeSilentRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      unsubscribeActivity()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [token, status, evaluateSession, maybeSilentRefresh])

  const handleClose = useCallback(() => {
    dismissedRef.current = true
    setOpen(false)
  }, [])

  const handleReset = useCallback(async () => {
    setRefreshing(true)
    setResetError(false)
    try {
      await refreshSession()
      recordActivity()
      dismissedRef.current = false
      expiryHandledRef.current = false
      setExpired(false)
      setOpen(false)
    } catch {
      setExpired(true)
      setResetError(true)
      setOpen(true)
    } finally {
      setRefreshing(false)
    }
  }, [refreshSession])

  return (
    <SessionTimeoutModal
      open={open}
      expired={expired}
      resetError={resetError}
      remainingMs={remainingMs}
      refreshing={refreshing}
      onReset={handleReset}
      onClose={handleClose}
    />
  )
}

export default SessionTimeoutProvider
