'use client'

import { useState, useEffect, useCallback } from 'react'
import { BriefingView } from '@/components/briefing/briefing-view'
import { LensPanel } from '@/components/lens/lens-panel'
import { GadflySheet } from '@/components/lens/gadfly-sheet'
import { CampaignPanel } from '@/components/campaign/campaign-panel'
import { CivicContextStrip } from '@/components/investigation/civic-context-strip'

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
  const [islandDarkMode, setIslandDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('republic-island-dark')
    if (saved === 'true') setIslandDarkMode(true)
  }, [])

  const handleToggleDarkMode = useCallback(() => {
    setIslandDarkMode(prev => {
      const next = !prev
      localStorage.setItem('republic-island-dark', String(next))
      return next
    })
  }, [])

  function handleOpenGadfly() {
    setGadflyOpen(true)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      {/* Briefing content */}
      <section>
        <BriefingView
          text={briefingText}
          isStreaming={false}
          darkMode={islandDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
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
            darkMode={islandDarkMode}
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
            darkMode={islandDarkMode}
          />
        </section>
      )}

      {/* 6. Civic Context strip — votes, discussion, reviews, archive */}
      <CivicContextStrip
        investigationId={id}
        isAuthor={isAuthor}
        archiveStatus={archiveStatus}
        expanded={civicExpanded}
        onExpand={setCivicExpanded}
      />

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
