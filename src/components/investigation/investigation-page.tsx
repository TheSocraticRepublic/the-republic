'use client'

import { BriefingView } from '@/components/briefing/briefing-view'
import { EscalationCard } from './escalation-card'

interface InvestigationPageProps {
  id: string
  concern: string
  jurisdictionName: string | null
  briefingText: string
}

export function InvestigationPage({
  id,
  concern,
  jurisdictionName,
  briefingText,
}: InvestigationPageProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
      {/* Concern context card */}
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

      {/* Briefing content */}
      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
        />
        <BriefingView text={briefingText} isStreaming={false} />
      </section>

      {/* Escalation paths */}
      <section>
        <div
          className="mb-6 h-px w-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
        />
        <EscalationCard investigationId={id} />
      </section>
    </div>
  )
}
