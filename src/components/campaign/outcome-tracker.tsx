'use client'

import { useState } from 'react'

interface TrackedMaterial {
  id: string
  materialType: string
  title: string
  createdAt: string
}

interface OutcomeTrackerProps {
  investigationId: string
  materials: TrackedMaterial[]
}

type OutcomeStatus = 'yes' | 'not_yet' | 'needs_help' | null

interface PromptState {
  foi: OutcomeStatus
  response: OutcomeStatus
  council: OutcomeStatus
}

const COMING_SOON_MSG = 'Coming soon — outcome tracking will be available in a future update.'

export function OutcomeTracker({ investigationId: _, materials }: OutcomeTrackerProps) {
  const [outcomes, setOutcomes] = useState<PromptState>({
    foi: null,
    response: null,
    council: null,
  })
  const [notice, setNotice] = useState<string | null>(null)

  function handleClick(field: keyof PromptState, value: OutcomeStatus) {
    setOutcomes((prev) => ({ ...prev, [field]: value }))
    setNotice(COMING_SOON_MSG)
    setTimeout(() => setNotice(null), 3500)
  }

  return (
    <div
      className="rounded-2xl border px-6 py-6 space-y-6"
      style={{
        backgroundColor: 'rgba(245, 243, 240, 0.035)',
        borderColor: 'rgba(255, 255, 255, 0.07)',
      }}
    >
      {/* Header */}
      <div className="space-y-1">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#C85B5B' }}
        >
          How is it going?
        </p>
        <p className="text-xs leading-relaxed text-neutral-500">
          {materials.length > 0
            ? `You have generated ${materials.length} material${materials.length > 1 ? 's' : ''}. Let us know how they are being used.`
            : 'Track what happens after you act.'}
        </p>
      </div>

      {/* Prompts */}
      <div className="space-y-5">
        {/* FOI */}
        <div className="space-y-2">
          <p className="text-sm" style={{ color: '#e2e0de' }}>
            Did you file the FOI request?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes"
              active={outcomes.foi === 'yes'}
              onClick={() => handleClick('foi', 'yes')}
            />
            <OutcomeButton
              label="Not yet"
              active={outcomes.foi === 'not_yet'}
              onClick={() => handleClick('foi', 'not_yet')}
            />
          </div>
        </div>

        {/* Response */}
        <div className="space-y-2">
          <p className="text-sm" style={{ color: '#e2e0de' }}>
            Has the public body responded?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes, I got a response"
              active={outcomes.response === 'yes'}
              onClick={() => handleClick('response', 'yes')}
            />
            <OutcomeButton
              label="No response yet"
              active={outcomes.response === 'not_yet'}
              onClick={() => handleClick('response', 'not_yet')}
            />
            <OutcomeButton
              label="I need help escalating"
              active={outcomes.response === 'needs_help'}
              onClick={() => handleClick('response', 'needs_help')}
              accent
            />
          </div>
        </div>

        {/* Council */}
        <div className="space-y-2">
          <p className="text-sm" style={{ color: '#e2e0de' }}>
            Did you present at a council meeting?
          </p>
          <div className="flex flex-wrap gap-2">
            <OutcomeButton
              label="Yes"
              active={outcomes.council === 'yes'}
              onClick={() => handleClick('council', 'yes')}
            />
            <OutcomeButton
              label="Not yet"
              active={outcomes.council === 'not_yet'}
              onClick={() => handleClick('council', 'not_yet')}
            />
          </div>
        </div>
      </div>

      {/* Coming soon notice */}
      {notice && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{
            backgroundColor: 'rgba(200,91,91,0.08)',
            border: '1px solid rgba(200,91,91,0.18)',
            color: '#C85B5B',
          }}
        >
          {notice}
        </div>
      )}
    </div>
  )
}

function OutcomeButton({
  label,
  active,
  onClick,
  accent = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-100"
      style={{
        backgroundColor: active
          ? accent
            ? 'rgba(200, 91, 91, 0.20)'
            : 'rgba(255,255,255,0.10)'
          : 'rgba(255,255,255,0.04)',
        color: active
          ? accent
            ? '#C85B5B'
            : '#e2e0de'
          : '#71717a',
        border: active
          ? accent
            ? '1px solid rgba(200,91,91,0.35)'
            : '1px solid rgba(255,255,255,0.14)'
          : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {label}
    </button>
  )
}
