'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { VoteBadge } from './vote-badge'
import { PartyBadge } from './party-badge'
import { MpLetterGenerator } from './mp-letter-generator'

interface RelevantVote {
  voteId: string
  date: string
  descriptionEn: string
  result: string
  relevanceExplanation: string | null
  mpBallot: string | null
}

interface MpInfo {
  id: string
  name: string
  party: string
  ridingName: string
  photoUrl: string | null
}

interface InvestigationVotePanelProps {
  investigationId: string
}

export function InvestigationVotePanel({ investigationId }: InvestigationVotePanelProps) {
  const [mp, setMp] = useState<MpInfo | null>(null)
  const [votes, setVotes] = useState<RelevantVote[]>([])
  const [concern, setConcern] = useState('')
  const [loading, setLoading] = useState(true)
  const [showLetterWriter, setShowLetterWriter] = useState(false)

  useEffect(() => {
    fetch(`/api/investigate/${investigationId}/votes`)
      .then((res) => (res.ok ? res.json() : { mp: null, votes: [], concern: '' }))
      .then((data) => {
        setMp(data.mp ?? null)
        setVotes(data.votes ?? [])
        setConcern(data.concern ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [investigationId])

  if (loading) {
    return (
      <div
        className="rounded-xl border px-5 py-4 animate-pulse"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.015)',
        }}
      >
        <div className="h-4 w-40 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </div>
    )
  }

  if (!mp && votes.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#D4764E' }}
        >
          Your MP's Record
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Compact MP card */}
      {mp && (
        <Link
          href={`/votes/mp/${mp.id}`}
          className="group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-white/[0.04]"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(255,255,255,0.015)',
          }}
        >
          {mp.photoUrl ? (
            <img src={mp.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#525252' }}
            >
              {mp.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-200 truncate">{mp.name}</p>
            <div className="flex items-center gap-2">
              <PartyBadge party={mp.party} />
              <span className="text-[10px] text-neutral-600">{mp.ridingName}</span>
            </div>
          </div>
        </Link>
      )}

      {/* Relevant votes */}
      {votes.length > 0 && (
        <div className="space-y-2">
          {votes.map((vote) => (
            <Link
              key={vote.voteId}
              href={`/votes/vote/${vote.voteId}`}
              className="group block rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-white/[0.04]"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                backgroundColor: 'rgba(255,255,255,0.015)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-300 leading-snug line-clamp-2">
                    {vote.descriptionEn}
                  </p>
                  {vote.relevanceExplanation && (
                    <p className="mt-1 text-[10px] text-neutral-500 italic">
                      {vote.relevanceExplanation}
                    </p>
                  )}
                  <span className="mt-1 text-[10px] text-neutral-600">{vote.date}</span>
                </div>
                {vote.mpBallot && <VoteBadge ballot={vote.mpBallot} size="md" />}
              </div>
            </Link>
          ))}
        </div>
      )}

      {mp && votes.length === 0 && (
        <p className="text-xs text-neutral-600 text-center py-2">
          No directly relevant votes found for this concern.
        </p>
      )}

      {/* Write to your MP button */}
      {mp && (
        <div className="pt-1">
          {showLetterWriter ? (
            <MpLetterGenerator
              mpId={mp.id}
              mpName={mp.name}
              defaultConcern={concern}
              voteIds={votes.map((v) => v.voteId)}
              investigationId={investigationId}
            />
          ) : (
            <button
              onClick={() => setShowLetterWriter(true)}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-150"
              style={{
                color: '#D4764E',
                backgroundColor: 'rgba(212,118,78,0.10)',
                border: '1px solid rgba(212,118,78,0.20)',
              }}
            >
              Write to your MP
            </button>
          )}
        </div>
      )}
    </div>
  )
}
