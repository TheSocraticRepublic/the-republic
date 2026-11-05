'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VoteBadge } from './vote-badge'
import { ResultLabel } from './result-label'

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
        <p className="text-sm text-text-faint mb-3">Voting records could not be loaded.</p>
        <button
          onClick={() => {
            setError(false)
            setLoading(true)
            setPage(1)
          }}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2"
        >
          Try again
        </button>
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
          <div data-mp-vote-row className="flex items-start gap-3">
            {/* The MP's own ballot leads the row (app-arms P1-9). */}
            <div data-ballot-column className="w-24 flex-shrink-0 pt-px">
              <VoteBadge ballot={vote.ballot} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text-secondary leading-snug line-clamp-3 md:line-clamp-2">
                {vote.descriptionEn}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span data-division className="text-2xs font-medium tabular-nums text-text-faint">
                  {vote.session}/{vote.number}
                </span>
                <span className="text-2xs font-medium text-text-faint">{vote.date}</span>
                <ResultLabel result={vote.result} size="2xs" />
              </div>
            </div>
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
