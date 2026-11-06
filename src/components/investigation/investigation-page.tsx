'use client'

import { useState } from 'react'
import { BriefingView } from '@/components/briefing/briefing-view'
import { LensPanel } from '@/components/lens/lens-panel'
import { GadflySheet } from '@/components/lens/gadfly-sheet'
import { CampaignPanel } from '@/components/campaign/campaign-panel'
import { CivicContextStrip } from '@/components/investigation/civic-context-strip'

// The island dark preference (localStorage `republic-island-dark`) is not read
// anywhere on this page until D4 makes the dark paper real (Jen D1 C3a, Razor
// DW1): with the toggle gone, a stored choice would leave panels dark with no
// way back, and the inline papers never darkened anyway.

interface InvestigationPageProps {
  id: string
  concern: string
  jurisdictionName: string | null
  briefingText: string
  initialLensOpen?: boolean      // true when lensOpenedAt is set (returning user)
  lensContextText?: string | null
  gadflySeededQuestion?: string | null
  initialCampaignOpen?: boolean  // true when campaignOpenedAt is set (returning user)
  isAuthor: boolean
  archiveStatus: string | null
}

export function InvestigationPage({
  id,
  concern,
  jurisdictionName,
  briefingText,
  initialLensOpen = false,
  lensContextText,
  gadflySeededQuestion,
  initialCampaignOpen = false,
  isAuthor,
  archiveStatus,
}: InvestigationPageProps) {
  const [lensOpen, setLensOpen] = useState(initialLensOpen)
  const [campaignOpen, setCampaignOpen] = useState(initialCampaignOpen)
  const [civicExpanded, setCivicExpanded] = useState<'votes' | 'discussion' | 'reviews' | 'archive' | null>(null)
  const [gadflyOpen, setGadflyOpen] = useState(false)
  const [gadflySessionId, setGadflySessionId] = useState<string | null>(null)

  function handleOpenGadfly() {
    setGadflyOpen(true)
  }

  return (
    <div className="investigation-thread mx-auto max-w-3xl px-6 py-12 space-y-10">
      {/* Briefing content */}
      <section>
        <BriefingView
          text={briefingText}
          isStreaming={false}
          // No dark toggle and no stored dark state on the briefing until D4
          // makes the dark paper real (Jen D1 C3a): the toggle only changed its
          // own icon while recording a preference D4 would later act on, and a
          // stored `true` would drop the paper's light arm inks (C1).
          onOpenLens={() => setLensOpen(true)}
          onOpenCampaign={() => setCampaignOpen(true)}
          onOpenGadfly={() => setGadflyOpen(true)}
          onScrollToQuestions={() => {
            document.getElementById('questions-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </section>

      {/* Lens panel — author only, conditionally rendered */}
      {isAuthor && lensOpen && (
        <section>
          <LensPanel
            investigationId={id}
            concern={concern}
            jurisdictionName={jurisdictionName}
            briefingText={briefingText}
            lensContextText={lensContextText}
            gadflySeededQuestion={gadflySeededQuestion}
            onOpenGadfly={handleOpenGadfly}
          />
        </section>
      )}

      {/* 5. Campaign panel — author only, conditionally rendered */}
      {isAuthor && campaignOpen && (
        <section>
          <CampaignPanel
            investigationId={id}
            concern={concern}
            jurisdictionName={jurisdictionName}
          />
        </section>
      )}

      {/* 6. Civic Context strip — votes, discussion, reviews, archive */}
      <section>
        <CivicContextStrip
          investigationId={id}
          isAuthor={isAuthor}
          archiveStatus={archiveStatus}
          expanded={civicExpanded}
          onExpand={setCivicExpanded}
        />
      </section>

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
