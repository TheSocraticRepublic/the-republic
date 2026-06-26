'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { BriefingView } from '@/components/briefing/briefing-view'
import { LensPanel } from '@/components/lens/lens-panel'
import { GadflySheet } from '@/components/lens/gadfly-sheet'
import { CampaignPanel } from '@/components/campaign/campaign-panel'
import { CivicContextStrip } from '@/components/investigation/civic-context-strip'

const ISLAND_DARK_KEY = 'republic-island-dark'
const ISLAND_DARK_EVENT = 'republic-island-dark-change'

function subscribeIslandDark(callback: () => void) {
  window.addEventListener(ISLAND_DARK_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(ISLAND_DARK_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

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
  // localStorage as an external store: server snapshot is false, the client
  // corrects after hydration, and same-tab toggles notify via a custom event.
  const islandDarkMode = useSyncExternalStore(
    subscribeIslandDark,
    () => localStorage.getItem(ISLAND_DARK_KEY) === 'true',
    () => false
  )

  const handleToggleDarkMode = useCallback(() => {
    const next = localStorage.getItem(ISLAND_DARK_KEY) !== 'true'
    localStorage.setItem(ISLAND_DARK_KEY, String(next))
    window.dispatchEvent(new Event(ISLAND_DARK_EVENT))
  }, [])

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
