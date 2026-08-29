'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STUCK_GENERATION_THRESHOLD_MINUTES } from '@/lib/investigation/constants'

interface GeneratingPollerProps {
  investigationId: string
}

const POLL_INTERVAL_MS = 3_000    // poll every 3 seconds
const HARD_STOP_MS    = STUCK_GENERATION_THRESHOLD_MINUTES * 60 * 1000  // match the reaper

type PollStatus = 'polling' | 'terminal' | 'hardstop'

/**
 * GeneratingPoller — polls GET /api/investigate/[id]/status every 3 seconds.
 *
 * On a terminal status (complete, failed, cancelled): calls router.refresh()
 * so the server component re-renders with the new state. A watchdog forces a
 * full page reload if router.refresh() silently fails after 5 seconds.
 *
 * After ~12 minutes (matching the server-side reaper) without a terminal
 * status: stops polling and shows a "still working — please refresh" message.
 *
 * Clears timers on unmount to avoid the "update on unmounted component" warning.
 */
export function GeneratingPoller({ investigationId }: GeneratingPollerProps) {
  const router = useRouter()
  const [pollStatus, setPollStatus] = useState<PollStatus>('polling')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false
    unmountedRef.current = false
    // Capture the start time inside the effect (impure — correct location)
    startTimeRef.current = Date.now()

    async function poll() {
      if (cancelled) return

      try {
        const res = await fetch(`/api/investigate/${investigationId}/status`, {
          headers: { 'Cache-Control': 'no-cache' },
        })

        if (!res.ok) {
          // Retry — transient error
          schedule()
          return
        }

        const data = (await res.json()) as { status: string; failureReason?: string | null }
        const terminal = data.status === 'complete' || data.status === 'failed' || data.status === 'cancelled'

        if (terminal) {
          setPollStatus('terminal')
          // Refresh the server component so it re-renders with the final state
          router.refresh()
          // Watchdog: if still mounted after 5s, router.refresh() silently failed
          watchdogRef.current = setTimeout(() => {
            if (!unmountedRef.current) {
              window.location.reload()
            }
          }, 5_000)
          return
        }

        // Non-terminal: check hard stop AFTER we know the server isn't done
        if (Date.now() - startTimeRef.current >= HARD_STOP_MS) {
          setPollStatus('hardstop')
          return
        }

        // Still generating — schedule next poll
        schedule()
      } catch {
        // Network error — retry
        if (!cancelled) schedule()
      }
    }

    function schedule() {
      if (cancelled) return
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
    }

    // Start the first poll after one interval
    schedule()

    return () => {
      cancelled = true
      unmountedRef.current = true
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (watchdogRef.current !== null) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
    }
  }, [investigationId, router])

  if (pollStatus === 'hardstop') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-xs text-text-faint"
      >
        Still working — this is taking longer than usual. Please{' '}
        <button
          onClick={() => router.refresh()}
          className="underline underline-offset-2 hover:text-text-secondary transition-colors"
        >
          refresh
        </button>{' '}
        to check on progress.
      </p>
    )
  }

  if (pollStatus === 'terminal') {
    // Brief message while router.refresh() propagates
    return (
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-xs text-text-faint"
      >
        Updating…
      </p>
    )
  }

  // polling
  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-2 text-xs text-text-faint"
    >
      Checking for updates…
    </p>
  )
}
