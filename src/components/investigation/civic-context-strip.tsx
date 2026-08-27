'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { InvestigationVotePanel } from '@/components/votes/investigation-vote-panel'
import { ReviewSection } from '@/components/review/review-section'
import { ThreadCard } from '@/components/forum/thread-card'
import { PermanenceBadge } from '@/components/archive/permanence-badge'
import { PreserveButton } from '@/components/archive/preserve-button'

type Section = 'votes' | 'discussion' | 'reviews' | 'archive'

interface CivicContextStripProps {
  investigationId: string
  isAuthor: boolean
  archiveStatus: string | null
  expanded: Section | null
  onExpand: (section: Section | null) => void
  darkMode?: boolean
}

interface VoteSummary {
  mpName: string | null
  voteCount: number
}

interface ThreadSummary {
  id: string
  title: string
  authorDisplayName: string
  postCount: number
  lastPostAt: string | null
  jurisdictionName?: string | null
  concernCategory?: string | null
  pinned: boolean
  status: 'open' | 'locked' | 'archived'
}

interface DiscussionSummary {
  threadCount: number
  lastActivity: string | null
  threads: ThreadSummary[]
}

interface ReviewSummaryData {
  count: number
  averageScore: number | null
}

const ACCENTS: Record<Section, string> = {
  votes: 'var(--accent-oracle)',
  discussion: 'var(--accent-gadfly)',
  reviews: 'var(--accent-mirror)',
  archive: 'var(--color-island-muted)',
}

function getArchiveMetric(status: string | null): string {
  if (!status) return 'Not archived'
  if (status === 'arweave_permanent') return 'Preserved'
  if (status === 'pending') return 'Pending'
  if (status === 'ipfs_pinned') return 'IPFS Pinned'
  if (status === 'failed') return 'Failed'
  return 'Not archived'
}

export function CivicContextStrip({
  investigationId,
  isAuthor,
  archiveStatus,
  expanded,
  onExpand,
  darkMode = false,
}: CivicContextStripProps) {
  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null)
  const [discussionSummary, setDiscussionSummary] = useState<DiscussionSummary | null>(null)
  const [reviewSummary, setReviewSummary] = useState<ReviewSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchVotes = fetch(`/api/investigate/${investigationId}/votes`)
      .then((r) => (r.ok ? r.json() : { mp: null, votes: [] }))
      .then((data) => {
        if (cancelled) return
        setVoteSummary({
          mpName: data.mp?.name ?? null,
          voteCount: data.votes?.length ?? 0,
        })
      })
      .catch(() => {
        if (!cancelled) setVoteSummary({ mpName: null, voteCount: 0 })
      })

    const fetchThreads = fetch(`/api/investigate/${investigationId}/threads`)
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((data) => {
        if (cancelled) return
        const threads: ThreadSummary[] = data.threads ?? []
        let lastActivity: string | null = null
        if (threads.length > 0) {
          const sorted = [...threads].sort((a, b) => {
            const aTime = a.lastPostAt ? new Date(a.lastPostAt).getTime() : 0
            const bTime = b.lastPostAt ? new Date(b.lastPostAt).getTime() : 0
            return bTime - aTime
          })
          lastActivity = sorted[0].lastPostAt ?? null
        }
        setDiscussionSummary({
          threadCount: threads.length,
          lastActivity,
          threads,
        })
      })
      .catch(() => {
        if (!cancelled)
          setDiscussionSummary({ threadCount: 0, lastActivity: null, threads: [] })
      })

    const fetchReviews = fetch(`/api/investigate/${investigationId}/reviews`)
      .then((r) => (r.ok ? r.json() : { reviews: [], aggregate: null }))
      .then((data) => {
        if (cancelled) return
        const count = data.aggregate?.count ?? data.reviews?.length ?? 0
        let averageScore: number | null = null
        if (data.aggregate?.averages) {
          const avgs = data.aggregate.averages
          const scores = [
            avgs.factualAccuracy,
            avgs.sourceQuality,
            avgs.missingContext,
            avgs.strategicEffectiveness,
            avgs.jurisdictionalAccuracy,
          ].filter((s: number) => typeof s === 'number')
          if (scores.length > 0) {
            averageScore =
              Math.round(
                (scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10
              ) / 10
          }
        }
        setReviewSummary({ count, averageScore })
      })
      .catch(() => {
        if (!cancelled) setReviewSummary({ count: 0, averageScore: null })
      })

    Promise.all([fetchVotes, fetchThreads, fetchReviews]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [investigationId])

  function handleCardClick(section: Section) {
    onExpand(expanded === section ? null : section)
  }

  const cards: {
    section: Section
    label: string
    metric: string
    subtext: string
  }[] = [
    {
      section: 'votes',
      label: 'Votes',
      metric: loading
        ? '...'
        : voteSummary?.mpName ?? `${voteSummary?.voteCount ?? 0} votes`,
      subtext: loading
        ? ''
        : voteSummary?.mpName
          ? `${voteSummary.voteCount} relevant vote${voteSummary.voteCount === 1 ? '' : 's'}`
          : 'No postal code',
    },
    {
      section: 'discussion',
      label: 'Discussion',
      metric: loading
        ? '...'
        : `${discussionSummary?.threadCount ?? 0} thread${(discussionSummary?.threadCount ?? 0) === 1 ? '' : 's'}`,
      subtext: loading
        ? ''
        : discussionSummary?.lastActivity
          ? `Last activity ${formatRelativeTime(discussionSummary.lastActivity)}`
          : 'No threads yet',
    },
    {
      section: 'reviews',
      label: 'Peer Reviews',
      metric: loading
        ? '...'
        : `${reviewSummary?.count ?? 0} review${(reviewSummary?.count ?? 0) === 1 ? '' : 's'}`,
      subtext: loading
        ? ''
        : reviewSummary?.averageScore != null
          ? `Avg ${reviewSummary.averageScore}/5`
          : 'None yet',
    },
    {
      section: 'archive',
      label: 'Archive',
      metric: getArchiveMetric(archiveStatus),
      subtext: '',
    },
  ]

  return (
    <div className={`mx-auto max-w-3xl${darkMode ? ' dark-island' : ''}`} style={{ marginTop: '2.5rem' }}>
      {/* Card strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const isActive = expanded === card.section
          const accent = ACCENTS[card.section]

          return (
            <button
              key={card.section}
              type="button"
              onClick={() => handleCardClick(card.section)}
              className="text-left rounded-lg transition-colors duration-150"
              style={{
                backgroundColor: isActive ? `color-mix(in srgb, ${accent} 3%, transparent)` : 'var(--color-island-bg)',
                border: `1px solid var(--color-island-border)`,
                borderBottom: isActive ? `2px solid ${accent}` : '1px solid var(--color-island-border)',
                padding: '0.75rem 1rem',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--color-island-hover)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isActive ? `color-mix(in srgb, ${accent} 3%, transparent)` : 'var(--color-island-bg)'
              }}
            >
              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--color-island-muted)',
                  margin: 0,
                }}
              >
                {card.label}
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--color-island-text)',
                  margin: '4px 0 0 0',
                  lineHeight: 1.3,
                }}
              >
                {card.metric}
              </p>
              {card.subtext && (
                <p
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-island-faint)',
                    margin: '2px 0 0 0',
                  }}
                >
                  {card.subtext}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* Expanded views */}
      {expanded === 'votes' && (
        <div style={{ marginTop: '1.5rem' }}>
          <InvestigationVotePanel investigationId={investigationId} />
        </div>
      )}

      {expanded === 'discussion' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="mb-4 flex items-center justify-between">
            <p
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-island-muted)',
                margin: 0,
              }}
            >
              Discussions
            </p>
            <Link
              href={`/forum?investigation=${investigationId}`}
              style={{
                fontSize: '12px',
                color: 'var(--color-island-muted)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              View all in Forum
            </Link>
          </div>
          {discussionSummary && discussionSummary.threads.length > 0 ? (
            <div className="space-y-3">
              {discussionSummary.threads.slice(0, 3).map((thread) => (
                <ThreadCard key={thread.id} {...thread} />
              ))}
              {discussionSummary.threads.length > 3 && (
                <Link
                  href={`/forum?investigation=${investigationId}`}
                  className="block text-center py-2"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-island-muted)',
                  }}
                >
                  View all {discussionSummary.threads.length} discussions
                </Link>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl px-5 py-6 text-center"
              style={{
                border: '1px solid var(--color-island-border)',
                backgroundColor: 'var(--color-island-bg)',
              }}
            >
              <p style={{ fontSize: '14px', color: 'var(--color-island-muted)', margin: 0 }}>
                This investigation hasn’t reached the forum yet.
              </p>
              <p style={{ marginTop: '6px' }}>
                <Link
                  href={`/forum/new?investigationId=${investigationId}`}
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-island-secondary)',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Start a discussion
                </Link>
              </p>
            </div>
          )}
        </div>
      )}

      {expanded === 'reviews' && (
        <div style={{ marginTop: '1.5rem' }}>
          <ReviewSection investigationId={investigationId} isAuthor={isAuthor} />
        </div>
      )}

      {expanded === 'archive' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div
            className="rounded-xl px-5 py-4"
            style={{
              border: '1px solid var(--color-island-border)',
              backgroundColor: 'var(--color-island-bg)',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--color-island-muted)',
                    margin: 0,
                  }}
                >
                  Archive Status
                </p>
                {archiveStatus ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <PermanenceBadge status={archiveStatus as 'pending' | 'ipfs_pinned' | 'arweave_permanent' | 'failed'} />
                    <Link
                      href={`/archive/${investigationId}`}
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-island-muted)',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                      }}
                    >
                      View archived record
                    </Link>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-island-faint)',
                      marginTop: '4px',
                    }}
                  >
                    This investigation has not been preserved.
                  </p>
                )}
              </div>
              {isAuthor && !archiveStatus && (
                <PreserveButton investigationId={investigationId} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
