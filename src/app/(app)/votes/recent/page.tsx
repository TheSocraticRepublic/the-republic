'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface VoteSummary {
  id: string
  session: string
  number: number
  date: string
  descriptionEn: string
  result: string
  yeaTotal: number
  nayTotal: number
}

export default function RecentVotesPage() {
  const [votes, setVotes] = useState<VoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/parliament/votes?page=${page}&limit=20`)
      .then((res) => (res.ok ? res.json() : { votes: [] }))
      .then((data) => {
        setVotes(data.votes ?? [])
        setHasMore(data.hasMore ?? false)
      })
      .catch(() => setVotes([]))
      .finally(() => setLoading(false))
  }, [page])

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1
          className="mb-2 text-xl font-bold tracking-tight text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Recent Votes
        </h1>
        <p className="text-xs text-neutral-500">
          Recorded divisions in the House of Commons
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
            />
          ))}
        </div>
      ) : votes.length === 0 ? (
        <div
          className="rounded-xl border px-6 py-10 text-center"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(255,255,255,0.015)',
          }}
        >
          <p className="text-sm text-neutral-500">
            No vote data available. Run a sync to populate parliamentary data.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {votes.map((vote) => (
              <Link
                key={vote.id}
                href={`/votes/vote/${vote.id}`}
                className="group block rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.10]"
                style={{
                  borderColor: 'rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255,255,255,0.015)',
                }}
              >
                <p className="text-xs font-medium text-neutral-300 leading-snug line-clamp-2 mb-1.5">
                  {vote.descriptionEn}
                </p>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-neutral-600">{vote.date}</span>
                  <span
                    className="rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider"
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
                  <span className="text-neutral-700">
                    {vote.yeaTotal}Y / {vote.nayTotal}N
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <span className="text-[10px] text-neutral-600">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
