'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { BriefingView } from '@/components/briefing/briefing-view'
import { EscalationCard } from './escalation-card'
import { LensPanel } from '@/components/lens/lens-panel'
import { GadflySheet } from '@/components/lens/gadfly-sheet'
import { CampaignPanel } from '@/components/campaign/campaign-panel'
import { ThreadCard } from '@/components/forum/thread-card'

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

interface InvestigationPageProps {
  id: string
  concern: string
  jurisdictionName: string | null
  briefingText: string
  initialLensOpen?: boolean      // true when lensOpenedAt is set (returning user)
  initialCampaignOpen?: boolean  // true when campaignOpenedAt is set (returning user)
}

export function InvestigationPage({
  id,
  concern,
  jurisdictionName,
  briefingText,
  initialLensOpen = false,
  initialCampaignOpen = false,
}: InvestigationPageProps) {
  const [lensOpen, setLensOpen] = useState(initialLensOpen)
  const [campaignOpen, setCampaignOpen] = useState(initialCampaignOpen)
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [discussionThreads, setDiscussionThreads] = useState<ThreadSummary[]>([])
  const [discussionLoading, setDiscussionLoading] = useState(false)
  const [gadflyOpen, setGadflyOpen] = useState(false)
  const [gadflySessionId, setGadflySessionId] = useState<string | null>(null)

  const handleGoDeeper = useCallback(() => setLensOpen(true), [])
  const handleTakeAction = useCallback(() => setCampaignOpen(true), [])
  const handleDiscuss = useCallback(() => setDiscussionOpen(true), [])

  useEffect(() => {
    if (!discussionOpen) return
    setDiscussionLoading(true)
    fetch(`/api/investigate/${id}/threads`)
      .then((res) => (res.ok ? res.json() : { threads: [] }))
      .then((data) => setDiscussionThreads(data.threads ?? []))
      .catch(() => setDiscussionThreads([]))
      .finally(() => setDiscussionLoading(false))
  }, [discussionOpen, id])

  function handleOpenGadfly() {
    setGadflyOpen(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      {/* 1. Concern context card */}
      <div
        className="rounded-xl border px-5 py-4"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.07)',
        }}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Your concern
          {jurisdictionName && (
            <span className="ml-2 normal-case tracking-normal font-normal text-neutral-700">
              — {jurisdictionName}
            </span>
          )}
        </p>
        <p className="text-sm leading-relaxed text-neutral-300">{concern}</p>
      </div>

      {/* 2. Briefing content */}
      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
        />
        <BriefingView text={briefingText} isStreaming={false} />
      </section>

      {/* 3. Escalation paths */}
      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
        />
        <EscalationCard
          investigationId={id}
          onGoDeeper={handleGoDeeper}
          onTakeAction={handleTakeAction}
          onDiscuss={handleDiscuss}
          lensOpen={lensOpen}
          campaignOpen={campaignOpen}
          discussionOpen={discussionOpen}
        />
      </section>

      {/* 4. Lens panel — conditionally rendered */}
      {lensOpen && (
        <section>
          <LensPanel
            investigationId={id}
            concern={concern}
            jurisdictionName={jurisdictionName}
            briefingText={briefingText}
            onOpenGadfly={handleOpenGadfly}
          />
        </section>
      )}

      {/* 5. Campaign panel — conditionally rendered */}
      {campaignOpen && (
        <section>
          <CampaignPanel
            investigationId={id}
            concern={concern}
            jurisdictionName={jurisdictionName}
          />
        </section>
      )}

      {/* 6. Discussion panel — conditionally rendered */}
      {discussionOpen && (
        <section>
          <div
            className="mb-6 h-px w-full"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
          />
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Discussions
            </p>
            <Link
              href={`/forum?investigation=${id}`}
              className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
            >
              View all in Forum
            </Link>
          </div>
          {discussionLoading ? (
            <p className="text-sm text-neutral-600">Loading discussions...</p>
          ) : discussionThreads.length > 0 ? (
            <div className="space-y-3">
              {discussionThreads.slice(0, 3).map((thread) => (
                <ThreadCard key={thread.id} {...thread} />
              ))}
              {discussionThreads.length > 3 && (
                <Link
                  href={`/forum?investigation=${id}`}
                  className="block text-xs text-neutral-500 hover:text-neutral-300 transition-colors text-center py-2"
                >
                  View all {discussionThreads.length} discussions
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-black/40 px-5 py-6 text-center">
              <p className="text-sm text-neutral-500">No discussions yet.</p>
              <p className="mt-1.5">
                <Link
                  href={`/forum/new?investigationId=${id}`}
                  className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200 transition-colors"
                >
                  Start a discussion
                </Link>
              </p>
            </div>
          )}
        </section>
      )}

      {/* 7. Gadfly slide-over dialog */}
      <GadflySheet
        open={gadflyOpen}
        onOpenChange={setGadflyOpen}
        investigationId={id}
        sessionId={gadflySessionId}
        concern={concern}
        onSessionCreated={setGadflySessionId}
      />
    </div>
  )
}
