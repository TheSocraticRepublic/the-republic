'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VoteBadge } from './vote-badge'

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
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/parliament/mps/${mpId}/votes?page=${page}&limit=20`)
      .then((res) => (res.ok ? res.json() : { votes: [] }))
      .then((data) => {
        setVotes(data.votes ?? [])
        setHasMore(data.hasMore ?? false)
      })
      .catch(() => setVotes([]))
      .finally(() => setLoading(false))
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
                <span className="text-[10px] text-text-faint">{vote.date}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                  style={{
                    color: vote.result === 'passed' ? '#4ade80' : '#ef4444',
                    backgroundColor:
                      vote.result === 'passed'
                        ? 'rgba(74,222,128,0.08)'
                        : 'rgba(239,68,68,0.08)',
                  }}
                >
                  {vote.result}
                </span>
              </div>
            </div>
            <VoteBadge ballot={vote.ballot} size="md" />
          </div>
        </Link>
      ))}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-[10px] text-text-faint">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
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
