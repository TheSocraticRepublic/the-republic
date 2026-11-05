'use client'

import { useState, useEffect } from 'react'

interface SyncStatus {
  lastSync: {
    startedAt: string | null
    completedAt: string | null
    durationMs: number | null
    recordsUpserted?: number | null
    errors?: unknown
  } | null
  counts?: {
    totalMps: number
    totalVotes: number
    totalBills: number
  }
}

/**
 * What the badge can say. `unknown` covers every way the sync time cannot be
 * read: the request rejected, a non-OK response, a body that is not JSON, no
 * sync on record, or a date that does not parse. In that state the badge says
 * "Sync time unknown" and nothing else; it never shows a guessed or computed
 * age. A failed newest sync (see `isFailedSync`) is unknown too.
 */
type BadgeState =
  | { kind: 'loading' }
  | { kind: 'unknown' }
  | { kind: 'known'; syncedAt: Date; daysSince: number; counts: SyncStatus['counts'] }

const STALE_AFTER_DAYS = 7
const MS_PER_DAY = 1000 * 60 * 60 * 24

function hasErrors(errors: unknown): boolean {
  if (errors == null) return false
  if (Array.isArray(errors)) return errors.length > 0
  if (typeof errors === 'string') return errors.length > 0
  if (typeof errors === 'object') return Object.keys(errors).length > 0
  return true
}

/**
 * A failed sync: it logged errors and upserted nothing. The status route
 * returns the newest attempt even when it failed (the sync route's catch sets
 * `completedAt`; the full-sync script leaves it null), so its date is not the
 * date of the data. A sync with some errors but some upserts keeps its date.
 */
export function isFailedSync(lastSync: SyncStatus['lastSync']): boolean {
  if (!lastSync) return false
  return hasErrors(lastSync.errors) && !lastSync.recordsUpserted
}

/** The sync time is `completedAt`, or `startedAt` when no sync has completed. */
export function readSyncTime(data: SyncStatus | null | undefined): Date | null {
  if (isFailedSync(data?.lastSync ?? null)) return null
  // The startedAt fallback covers only a row that is not failed: an in-progress sync.
  const raw = data?.lastSync?.completedAt ?? data?.lastSync?.startedAt
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * `standalone` (the /votes landing) is the badge on its own: 11px/500, with
 * the MP and vote counts. `meta` sits in DetailHeader's meta line: the date
 * line only, in the line's own 12px/400 type, because counts beside an MP's
 * name read as that MP's tally (Jen E1 C3).
 */
export type FreshnessVariant = 'standalone' | 'meta'

const TYPE: Record<FreshnessVariant, string> = {
  standalone: 'text-2xs font-medium',
  meta: 'text-xs font-normal',
}

export function DataFreshnessBadge({ variant = 'standalone' }: { variant?: FreshnessVariant } = {}) {
  const type = TYPE[variant]
  const [state, setState] = useState<BadgeState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/api/parliament/sync/status')
      .then((res) => {
        if (!res.ok) throw new Error(`sync status ${res.status}`)
        return res.json() as Promise<SyncStatus>
      })
      .then((data) => {
        if (cancelled) return
        const syncedAt = readSyncTime(data)
        if (!syncedAt) {
          setState({ kind: 'unknown' })
          return
        }
        // Computed at fetch time: Date.now() is impure during render.
        const daysSince = Math.floor((Date.now() - syncedAt.getTime()) / MS_PER_DAY)
        setState({ kind: 'known', syncedAt, daysSince, counts: data.counts })
      })
      .catch(() => {
        // Not swallowed: a failed or malformed request is shown to the reader
        // as "Sync time unknown", the same honest state as no sync on record.
        if (!cancelled) setState({ kind: 'unknown' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading') {
    // Neutral placeholder, same line height as the final text, so the meta
    // line does not jump when the answer arrives.
    return (
      <div
        data-freshness="loading"
        aria-busy="true"
        data-variant={variant}
        className={`flex items-center gap-2 ${type} text-text-faint`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span>Checking sync time</span>
      </div>
    )
  }

  if (state.kind === 'unknown') {
    return (
      <div data-freshness="unknown" data-variant={variant} className={`flex items-center gap-2 ${type} text-text-muted`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <span>Sync time unknown</span>
      </div>
    )
  }

  const isStale = state.daysSince > STALE_AFTER_DAYS
  const color = isStale ? 'var(--status-warning)' : 'var(--text-muted)'
  const counts = variant === 'standalone' ? state.counts : undefined

  return (
    <div data-freshness="known" data-variant={variant} className={`flex items-center gap-2 ${type}`} style={{ color }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>
        Data as of {state.syncedAt.toLocaleDateString('en-CA')}
        {isStale && ' (stale)'}
      </span>
      {counts && counts.totalMps > 0 && (
        <span style={{ color: 'var(--text-muted)' }}>
          {counts.totalMps} MPs, {counts.totalVotes} votes
        </span>
      )}
    </div>
  )
}
