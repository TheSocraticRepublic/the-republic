'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PartyBadge } from './party-badge'
import { BALLOT_ORDER, ballotLabel } from './result-label'

export interface BallotRecord {
  mpId: string
  mpName: string
  party: string
  ridingName: string
  ballot: string
}

export type BallotSort = 'party' | 'name'

export interface BallotGroup {
  ballot: string
  label: string
  rows: BallotRecord[]
}

const SORT_LABELS: Record<BallotSort, string> = {
  party: 'Party',
  name: 'Name',
}

/**
 * Groups ballots under Yea, Nay, Paired and Didn't vote, in that order
 * (app-arms P2-5), sorting each group by the chosen key. An empty group is
 * left out. A value outside the ballot enum is not folded into another group:
 * it gets a group of its own, after the four, under the value as stored.
 */
export function groupBallots(ballots: BallotRecord[], sortBy: BallotSort): BallotGroup[] {
  const sorted = [...ballots].sort((a, b) => {
    if (sortBy === 'party') return a.party.localeCompare(b.party) || a.mpName.localeCompare(b.mpName)
    return a.mpName.localeCompare(b.mpName)
  })
  const order: string[] = [...BALLOT_ORDER]
  for (const b of sorted) {
    if (!order.includes(b.ballot)) order.push(b.ballot)
  }
  return order
    .map((ballot) => ({
      ballot,
      label: ballotLabel(ballot),
      rows: sorted.filter((b) => b.ballot === ballot),
    }))
    .filter((g) => g.rows.length > 0)
}

interface BallotListProps {
  voteId: string
}

export function BallotList({ voteId }: BallotListProps) {
  const [ballots, setBallots] = useState<BallotRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<BallotSort>('party')

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

  return <BallotGroups ballots={ballots} sortBy={sortBy} onSort={setSortBy} />
}

interface BallotGroupsProps {
  ballots: BallotRecord[]
  sortBy: BallotSort
  onSort: (sort: BallotSort) => void
}

/** The rendered list, apart from the fetch, so it can be tested as markup. */
export function BallotGroups({ ballots, sortBy, onSort }: BallotGroupsProps) {
  const groups = groupBallots(ballots, sortBy)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {/* No count here or on the group headers: the rows are the ballots
            the app has on record, which can be a few short of the House's
            totals (the sync skips MPs it does not hold), and the official
            figures are the Tally's (Razor C1). */}
        <p className="text-3xs font-semibold uppercase text-text-faint">
          Recorded ballots
        </p>
        <div className="flex items-center gap-2" role="group" aria-label="Sort ballots by">
          {(Object.keys(SORT_LABELS) as BallotSort[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sortBy === s}
              onClick={() => onSort(s)}
              // A pressed toggle is neutral, told apart by lightness, not the
              // arm's action hue (Jen E2b C6, the C2b rule). min-h-6 in flow,
              // and on coarse pointers a 44px hit area laid over it (E1's
              // DetailHeader back-link recipe).
              className={`relative min-h-6 rounded border px-2 py-1 text-2xs font-medium transition-colors pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5 ${
                sortBy === s
                  ? 'border-text-muted bg-surface-3 text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {SORT_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.ballot} data-ballot-group={g.ballot} aria-labelledby={`ballot-group-${g.ballot}`}>
            {/* Sticky, so a row deep in a long group still has its ballot on
                screen (Jen C1, E2a's letter-header recipe). */}
            <h2
              id={`ballot-group-${g.ballot}`}
              className="sticky top-0 z-10 mb-1 bg-surface-2 px-3 py-1 text-sm font-semibold text-text-secondary"
            >
              {g.label}
            </h2>
            <div className="space-y-1">
              {g.rows.map((b) => (
                <Link
                  key={b.mpId}
                  href={`/votes/mp/${b.mpId}`}
                  className="flex scroll-mt-8 items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150 hover:bg-surface-3"
                >
                  <span className="text-xs text-text-secondary truncate">
                    {b.mpName}
                  </span>
                  <PartyBadge party={b.party} />
                  {/* The ballot, for a link list read out of its group. */}
                  <span className="sr-only">, {g.label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
