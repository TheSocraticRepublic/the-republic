'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface GeneratingPollerProps {
  investigationId: string
}

const POLL_INTERVAL_MS = 3_000    // poll every 3 seconds
const HARD_STOP_MS    = 5 * 60 * 1000  // give up after 5 minutes

type PollStatus = 'polling' | 'terminal' | 'hardstop'

/**
 * GeneratingPoller — polls GET /api/investigate/[id]/status every 3 seconds.
 *
 * On a terminal status (complete, failed, cancelled): calls router.refresh()
 * so the server component re-renders with the new state.
 *
 * After ~5 minutes without a terminal status: stops polling and shows a
 * "still working — please refresh" message so the user isn't left hanging.
 *
 * Clears the timer on unmount to avoid the "update on unmounted component" warning.
 */
export function GeneratingPoller({ investigationId }: GeneratingPollerProps) {
  const router = useRouter()
  const [pollStatus, setPollStatus] = useState<PollStatus>('polling')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false
    // Capture the start time inside the effect (impure — correct location)
    startTimeRef.current = Date.now()

    async function poll() {
      if (cancelled) return

      // Hard stop
      if (Date.now() - startTimeRef.current >= HARD_STOP_MS) {
        setPollStatus('hardstop')
        return
      }

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
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
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
