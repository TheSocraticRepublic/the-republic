'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VoteBadge } from './vote-badge'

function resultColor(result: string): string {
  if (result === 'passed') return 'var(--status-success)'
  if (result === 'tie') return 'var(--status-warning)'
  return 'var(--status-danger)'
}

interface MpVoteRecord {
  voteId: string
  session: string
  number: number
  date: string
  descriptionEn: string
  result: string
  ballot: string
}

interface MpVoteListProps {
  mpId: string
}

export function MpVoteList({ mpId }: MpVoteListProps) {
  const [votes, setVotes] = useState<MpVoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/parliament/mps/${mpId}/votes?page=${page}&limit=20`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setVotes(data.votes ?? [])
        setHasMore(data.hasMore ?? false)
        setError(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [mpId, page])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl animate-pulse"
            style={{ backgroundColor: 'var(--surface-1)' }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-xl border px-6 py-8 text-center"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <p className="text-sm text-text-faint">Voting records could not be loaded.</p>
      </div>
    )
  }

  if (votes.length === 0) {
    return (
      <div
        className="rounded-xl border px-6 py-8 text-center"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface-1)',
        }}
      >
        <p className="text-sm text-text-faint">No voting records found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {votes.map((vote) => (
        <Link
          key={vote.voteId}
          href={`/votes/vote/${vote.voteId}`}
          className="group block rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--surface-1)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-secondary leading-snug line-clamp-2">
                {vote.descriptionEn}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-2xs font-medium text-text-faint">{vote.date}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider"
                  style={{
                    color: resultColor(vote.result),
                    backgroundColor: `color-mix(in srgb, ${resultColor(vote.result)} 8%, transparent)`,
                  }}
                >
                  {vote.result}
                </span>
              </div>
            </div>
            <VoteBadge ballot={vote.ballot} />
          </div>
        </Link>
      ))}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => {
              setLoading(true)
              setPage((p) => Math.max(1, p - 1))
            }}
            disabled={page <= 1}
            className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-2xs font-medium text-text-faint">Page {page}</span>
          <button
            onClick={() => {
              setLoading(true)
              setPage((p) => p + 1)
            }}
            disabled={!hasMore}
            className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
