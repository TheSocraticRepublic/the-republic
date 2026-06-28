'use client'

import { useState, useEffect } from 'react'

interface SyncStatus {
  lastSync: {
    startedAt: string
    completedAt: string | null
    durationMs: number | null
  } | null
  counts: {
    totalMps: number
    totalVotes: number
    totalBills: number
  }
}

export function DataFreshnessBadge() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  // Computed at fetch time — Date.now() is impure during render
  const [daysSince, setDaysSince] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/parliament/sync/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SyncStatus | null) => {
        if (!data) return
        const last = data.lastSync?.completedAt ?? data.lastSync?.startedAt
        setDaysSince(
          last
            ? Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
            : null
        )
        setStatus(data)
      })
      .catch(() => {})
  }, [])

  if (!status) return null

  const lastSyncDate = status.lastSync?.completedAt ?? status.lastSync?.startedAt

  const isStale = daysSince !== null && daysSince > 7
  const color = isStale ? '#f59e0b' : 'var(--text-muted)'

  return (
    <div className="flex items-center gap-2 text-[10px]" style={{ color }}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {lastSyncDate ? (
        <span>
          Data as of {new Date(lastSyncDate).toLocaleDateString('en-CA')}
          {isStale && ' (stale)'}
        </span>
      ) : (
        <span>No data synced</span>
      )}
      {status.counts.totalMps > 0 && (
        <span style={{ color: 'var(--text-muted)' }}>
          {status.counts.totalMps} MPs, {status.counts.totalVotes} votes
        </span>
      )}
    </div>
  )
}
