'use client'

import { useEffect, useRef, useState } from 'react'
import { MATERIAL_TYPE_LABELS } from '@/lib/campaign/schemas'
import { InfographicPreview } from '@/components/campaign/infographic-preview'

interface ReasoningCardProps {
  materialType: string
  content: string   // The JSON spec as a string
  reasoning: string
  title: string
}

// Parse and render an infographic spec — with Data / Preview tab toggle
function InfographicView({ spec }: { spec: Record<string, unknown> }) {
  const [tab, setTab] = useState<'data' | 'preview'>('data')
  const dataPoints = (spec.dataPoints as Array<{ label: string; value: string | number; source: string; emphasis: boolean }>) ?? []

  // Shape spec for InfographicPreview
  const previewSpec = {
    title: (spec.title as string) ?? 'Infographic',
    subtitle: spec.subtitle as string | undefined,
    dataPoints,
    comparison: spec.comparison as { before: string; after: string; source: string } | undefined,
    timeline: spec.timeline as Array<{ date: string; event: string }> | undefined,
    callToAction: (spec.callToAction as string) ?? '',
  }

  return (
    <div className="space-y-3">
      {/* Tab toggle */}
      <div className="flex items-center gap-1">
        {(['data', 'preview'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition-colors"
            style={{
              backgroundColor: tab === t ? 'rgba(200,91,91,0.1)' : 'transparent',
              color: tab === t ? '#C85B5B' : '#a8a29e',
              border: tab === t ? '1px solid rgba(200,91,91,0.2)' : '1px solid transparent',
            }}
          >
            {t === 'data' ? 'Data' : 'Preview'}
          </button>
        ))}
      </div>

      {tab === 'data' ? (
        <div className="space-y-2">
          {dataPoints.map((dp, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-4 rounded-lg px-3 py-2.5"
              style={{
                backgroundColor: dp.emphasis ? 'rgba(200, 91, 91, 0.07)' : 'rgba(0,0,0,0.04)',
                border: dp.emphasis ? '1px solid rgba(200,91,91,0.18)' : '1px solid transparent',
              }}
            >
              <span className="text-sm" style={{ color: '#44403c' }}>{dp.label}</span>
              <span
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: dp.emphasis ? '#C85B5B' : '#292524' }}
              >
                {String(dp.value)}
              </span>
            </div>
          ))}
          {!!spec.callToAction && (
            <p className="mt-3 text-xs font-medium" style={{ color: '#78716c' }}>
              Call to action: {spec.callToAction as string}
            </p>
          )}
        </div>
      ) : (
        <InfographicPreview spec={previewSpec} />
      )}
    </div>
  )
}

// Parse and render a fact sheet spec
function FactSheetView({ spec }: { spec: Record<string, unknown> }) {
  const keyFindings = (spec.keyFindings as Array<{ finding: string; evidence: string; source: string }>) ?? []
  return (
    <div className="space-y-4">
      {!!spec.headline && (
        <p className="text-sm font-semibold leading-snug" style={{ color: '#292524' }}>
          {spec.headline as string}
        </p>
      )}
      <div className="space-y-3">
        {keyFindings.map((kf, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm leading-snug" style={{ color: '#292524' }}>{kf.finding}</p>
            <p className="text-xs leading-relaxed" style={{ color: '#78716c' }}>
              {kf.evidence}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Parse and render social post spec
function SocialPostView({ spec }: { spec: Record<string, unknown> }) {
  const variations = (spec.variations as Array<{ tone: string; text: string; characterCount: number; hashtags: string[] }>) ?? []
  return (
    <div className="space-y-4">
      {variations.map((v, i) => (
        <div
          key={i}
          className="rounded-lg p-3 space-y-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#a8a29e' }}
            >
              {v.tone}
            </span>
            <span className="text-[10px]" style={{ color: '#a8a29e' }}>
              {v.characterCount} chars
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#292524' }}>{v.text}</p>
          {v.hashtags?.length > 0 && (
            <p className="text-xs" style={{ color: '#78716c' }}>
              {v.hashtags.map((h) => `#${h}`).join(' ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// Parse and render talking points spec (summary only — detailed view in TalkingPointsCard)
function TalkingPointsSummaryView({ spec }: { spec: Record<string, unknown> }) {
  const points = (spec.points as Array<{ claim: string }>) ?? []
  return (
    <div className="space-y-2">
      {points.map((p, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
        >
          <span
            className="mt-0.5 flex-shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: '#C85B5B' }}
          >
            {i + 1}
          </span>
          <p className="text-sm leading-snug" style={{ color: '#292524' }}>{p.claim}</p>
        </div>
      ))}
    </div>
  )
}

// Parse and render timeline spec
function TimelineView({ spec }: { spec: Record<string, unknown> }) {
  const events = (spec.events as Array<{ date: string; event: string; significance: string; actor?: string }>) ?? []
  const deadlines = (spec.deadlines as Array<{ date: string; action: string; critical: boolean }>) ?? []

  const allItems = [
    ...events.map((e) => ({ ...e, kind: 'event' as const })),
    ...deadlines.map((d) => ({ ...d, event: d.action, significance: '', kind: 'deadline' as const })),
  ].sort((a, b) => {
    const aTime = new Date(a.date).getTime()
    const bTime = new Date(b.date).getTime()
    if (isNaN(aTime) && isNaN(bTime)) return 0
    if (isNaN(aTime)) return 1
    if (isNaN(bTime)) return -1
    return aTime - bTime
  })

  return (
    <div className="space-y-2">
      {allItems.map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: item.kind === 'deadline' && (item as typeof deadlines[0]).critical
                  ? '#C85B5B'
                  : item.kind === 'deadline'
                  ? '#a8a29e'
                  : '#78716c',
              }}
            />
            {i < allItems.length - 1 && (
              <div className="w-px flex-1 mt-1" style={{ backgroundColor: 'rgba(0,0,0,0.08)', minHeight: '12px' }} />
            )}
          </div>
          <div className="pb-2">
            <p className="text-[10px] font-medium" style={{ color: '#a8a29e' }}>{item.date}</p>
            <p className="text-sm" style={{ color: '#292524' }}>{item.event}</p>
            {item.significance && (
              <p className="text-xs" style={{ color: '#78716c' }}>{item.significance}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Parse and render comparison spec
function ComparisonView({ spec }: { spec: Record<string, unknown> }) {
  const alternatives = (spec.alternatives as Array<{ jurisdiction: string; policy: string; outcome: string }>) ?? []
  const subject = spec.subject as { jurisdiction: string; policy: string; outcome?: string }

  return (
    <div className="space-y-3">
      {!!subject && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ backgroundColor: 'rgba(200,91,91,0.06)', border: '1px solid rgba(200,91,91,0.15)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#C85B5B' }}>
            Current — {subject.jurisdiction}
          </p>
          <p className="text-sm" style={{ color: '#292524' }}>{subject.policy}</p>
        </div>
      )}
      {alternatives.map((alt, i) => (
        <div
          key={i}
          className="rounded-lg px-3 py-2.5"
          style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#a8a29e' }}>
            {alt.jurisdiction}
          </p>
          <p className="text-sm" style={{ color: '#292524' }}>{alt.policy}</p>
          {alt.outcome && (
            <p className="text-xs mt-1" style={{ color: '#78716c' }}>{alt.outcome}</p>
          )}
        </div>
      ))}
      {!!spec.argumentFromExistence && (
        <p className="text-xs leading-relaxed pt-1" style={{ color: '#78716c' }}>
          {spec.argumentFromExistence as string}
        </p>
      )}
    </div>
  )
}

function SpecView({ materialType, spec }: { materialType: string; spec: Record<string, unknown> }) {
  switch (materialType) {
    case 'infographic':
      return <InfographicView spec={spec} />
    case 'fact_sheet':
      return <FactSheetView spec={spec} />
    case 'social_post':
      return <SocialPostView spec={spec} />
    case 'talking_points':
      return <TalkingPointsSummaryView spec={spec} />
    case 'timeline':
      return <TimelineView spec={spec} />
    case 'comparison':
      return <ComparisonView spec={spec} />
    default:
      return (
        <pre className="text-xs overflow-auto whitespace-pre-wrap" style={{ color: '#44403c' }}>
          {JSON.stringify(spec, null, 2)}
        </pre>
      )
  }
}

export function ReasoningCard({ materialType, content, reasoning, title }: ReasoningCardProps) {
  const [copied, setCopied] = useState(false)
  const [showClaudeHint, setShowClaudeHint] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover on click-outside or Escape
  useEffect(() => {
    if (!showClaudeHint) return

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowClaudeHint(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowClaudeHint(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showClaudeHint])

  let spec: Record<string, unknown> = {}
  try {
    spec = JSON.parse(content)
  } catch {
    // Malformed JSON — render raw
  }

  const label = MATERIAL_TYPE_LABELS[materialType as keyof typeof MATERIAL_TYPE_LABELS] ?? materialType

  function handleDownload() {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${materialType}-${Date.now()}.json`
    a.click()
    // Defer revoke so Safari has time to initiate the download before the URL is freed
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'rgba(200, 91, 91, 0.15)' }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{
          backgroundColor: 'rgba(200, 91, 91, 0.05)',
          borderColor: 'rgba(200, 91, 91, 0.12)',
        }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#C85B5B' }}
          >
            {label}
          </p>
          <p className="mt-0.5 text-sm font-medium" style={{ color: '#292524' }}>{title}</p>
        </div>

        {/* Export actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(0,0,0,0.05)',
              color: '#78716c',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'rgba(200, 91, 91, 0.08)',
              color: '#C85B5B',
              border: '1px solid rgba(200,91,91,0.2)',
            }}
          >
            Download JSON
          </button>
          {/* Open in Claude — shows the Artifacts template instructions */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowClaudeHint((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(137,180,200,0.1)',
                color: '#89b4c8',
                border: '1px solid rgba(137,180,200,0.25)',
              }}
              aria-label="Open in Claude — show instructions"
            >
              Open in Claude
            </button>
            {showClaudeHint && (
              <div
                className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl p-4 shadow-lg"
                style={{
                  backgroundColor: '#fafaf9',
                  border: '1px solid #e7e5e4',
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#89b4c8' }}>
                  Render in Claude Artifacts
                </p>
                <ol className="space-y-1.5 text-xs leading-relaxed" style={{ color: '#44403c' }}>
                  <li>1. Click <strong>Copy JSON</strong> above to copy your spec</li>
                  <li>2. Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#89b4c8' }}>claude.ai</a> in a new tab</li>
                  <li>3. Use the prompt template from <code className="rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: '#292524' }}>docs/claude-artifacts-template.md</code></li>
                  <li>4. Paste the template prompt, then your JSON at the end</li>
                </ol>
                <button
                  onClick={() => setShowClaudeHint(false)}
                  className="mt-3 text-[10px]"
                  style={{ color: '#a8a29e' }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 sm:grid-cols-2 items-stretch">
        {/* Left: Spec */}
        <div
          className="h-full px-6 py-6 border-b sm:border-b-0 sm:border-r min-h-[180px]"
          style={{
            backgroundColor: '#faf9f7',
            borderColor: 'rgba(0,0,0,0.06)',
          }}
        >
          <p
            className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#a8a29e' }}
          >
            Generated Spec
          </p>
          <SpecView materialType={materialType} spec={spec} />
        </div>

        {/* Right: Reasoning */}
        <div
          className="h-full px-6 py-6 min-h-[180px]"
          style={{ backgroundColor: 'rgba(200, 91, 91, 0.06)' }}
        >
          <p
            className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: '#C85B5B' }}
          >
            Why This Framing
          </p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: '#44403c' }}
          >
            {reasoning}
          </p>
        </div>
      </div>
    </div>
  )
}
