'use client'

import { useState } from 'react'

interface TalkingPoint {
  claim: string
  evidence: string
  anticipatedPushback: string
  response: string
  source: string
}

interface TalkingPointsCardProps {
  points: TalkingPoint[]
  context: string
}

function TalkingPointItem({ point, index }: { point: TalkingPoint; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: expanded ? 'rgba(200, 91, 91, 0.25)' : 'rgba(0,0,0,0.07)',
        backgroundColor: expanded ? 'rgba(200, 91, 91, 0.02)' : '#faf9f7',
        transition: 'border-color 150ms, background-color 150ms',
      }}
    >
      {/* Collapsed: claim only */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="mt-0.5 flex-shrink-0 text-xs font-semibold tabular-nums"
          style={{ color: '#C85B5B' }}
        >
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium leading-snug" style={{ color: '#292524' }}>
          {point.claim}
        </span>
        <span
          className="flex-shrink-0 text-xs mt-0.5 transition-transform duration-150"
          style={{
            color: '#a8a29e',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {/* Evidence */}
          <div className="pt-4 space-y-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#a8a29e' }}
            >
              Evidence
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#44403c' }}>
              {point.evidence}
            </p>
          </div>

          {/* Anticipated pushback — visually distinct */}
          <div
            className="rounded-lg px-4 py-3 space-y-1"
            style={{
              backgroundColor: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.07)',
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#78716c' }}
            >
              They may say
            </p>
            <p
              className="text-sm leading-relaxed italic"
              style={{ color: '#78716c' }}
            >
              "{point.anticipatedPushback}"
            </p>
          </div>

          {/* Response */}
          <div className="space-y-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#a8a29e' }}
            >
              Your response
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#44403c' }}>
              {point.response}
            </p>
          </div>

          {/* Source */}
          <p className="text-xs" style={{ color: '#a8a29e' }}>
            Source: {point.source}
          </p>
        </div>
      )}
    </div>
  )
}

export function TalkingPointsCard({ points, context }: TalkingPointsCardProps) {
  return (
    <div className="space-y-3">
      {context && (
        <p className="text-xs leading-relaxed" style={{ color: '#78716c' }}>
          {context}
        </p>
      )}
      <div className="space-y-2">
        {points.map((point, i) => (
          <TalkingPointItem key={i} point={point} index={i} />
        ))}
      </div>
      <p className="text-[10px] pt-1" style={{ color: '#a8a29e' }}>
        Tap any point to see evidence, anticipated pushback, and response.
      </p>
    </div>
  )
}
