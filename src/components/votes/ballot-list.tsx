'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VoteBadge } from './vote-badge'
import { PartyBadge } from './party-badge'

interface BallotRecord {
  mpId: string
  mpName: string
  party: string
  ridingName: string
  ballot: string
}

interface BallotListProps {
  voteId: string
}

export function BallotList({ voteId }: BallotListProps) {
  const [ballots, setBallots] = useState<BallotRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'party' | 'name' | 'ballot'>('party')

  useEffect(() => {
    fetch(`/api/parliament/votes/${voteId}/ballots?limit=400`)
      .then((res) => (res.ok ? res.json() : { ballots: [] }))
      .then((data) => setBallots(data.ballots ?? []))
      .catch(() => setBallots([]))
      .finally(() => setLoading(false))
  }, [voteId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--surface-1)' }}
          />
        ))}
      </div>
    )
  }

  const sorted = [...ballots].sort((a, b) => {
    if (sortBy === 'party') return a.party.localeCompare(b.party) || a.mpName.localeCompare(b.mpName)
    if (sortBy === 'name') return a.mpName.localeCompare(b.mpName)
    return a.ballot.localeCompare(b.ballot) || a.mpName.localeCompare(b.mpName)
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-text-faint">
          All Ballots ({ballots.length})
        </p>
        <div className="flex gap-2">
          {(['party', 'name', 'ballot'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="text-[10px] px-2 py-1 rounded transition-colors"
              style={{
                color: sortBy === s ? 'var(--accent-votes)' : '#525252',
                backgroundColor:
                  sortBy === s ? 'rgba(212,118,78,0.10)' : 'transparent',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {sorted.map((b) => (
          <Link
            key={b.mpId}
            href={`/votes/mp/${b.mpId}`}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all duration-150 hover:bg-surface-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-text-secondary truncate">
                {b.mpName}
              </span>
              <PartyBadge party={b.party} />
            </div>
            <VoteBadge ballot={b.ballot} />
          </Link>
        ))}
      </div>
    </div>
  )
}
