'use client'

import { useState } from 'react'
import { BriefingView } from '@/components/briefing/briefing-view'
import { EscalationCard } from './escalation-card'
import { LensPanel } from '@/components/lens/lens-panel'
import { GadflySheet } from '@/components/lens/gadfly-sheet'

interface InvestigationPageProps {
  id: string
  concern: string
  jurisdictionName: string | null
  briefingText: string
  initialLensOpen?: boolean   // true when lensOpenedAt is set (returning user)
}

export function InvestigationPage({
  id,
  concern,
  jurisdictionName,
  briefingText,
  initialLensOpen = false,
}: InvestigationPageProps) {
  const [lensOpen, setLensOpen] = useState(initialLensOpen)
  const [gadflyOpen, setGadflyOpen] = useState(false)
  const [gadflySessionId, setGadflySessionId] = useState<string | null>(null)

  function handleGoDeeper() {
    setLensOpen(true)
  }

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
          lensOpen={lensOpen}
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

      {/* 5. Gadfly slide-over dialog */}
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
