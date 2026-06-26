'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MATERIAL_TYPE_LABELS } from '@/lib/campaign/schemas'
import { campaignSpecToMarkdown } from '@/lib/campaign/export'
import { hasCampaignPdfTemplate } from '@/lib/pdf/types'
import { InfographicPreview } from '@/components/campaign/infographic-preview'
import type { CampaignMaterial } from '@/lib/campaign/schemas'

const LIGHT_RC = {
  border: '#e0ddd9',
  headerBg: 'color-mix(in srgb, var(--accent-lever) 5%, transparent)',
  headerBorder: 'color-mix(in srgb, var(--accent-lever) 12%, transparent)',
  titleColor: '#292524',
  specBg: '#faf9f7',
  specBorder: 'rgba(0,0,0,0.06)',
  reasoningBg: 'color-mix(in srgb, var(--accent-lever) 6%, transparent)',
  textColor: '#44403c',
  mutedColor: '#78716c',
  faintColor: '#a8a29e',
  buttonBg: 'rgba(0,0,0,0.05)',
  buttonBorder: 'rgba(0,0,0,0.08)',
  buttonColor: '#78716c',
  popoverBg: '#fafaf9',
  popoverBorder: '#e7e5e4',
}

const DARK_RC = {
  border: 'rgba(255,255,255,0.1)',
  headerBg: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
  headerBorder: 'color-mix(in srgb, var(--accent-lever) 18%, transparent)',
  titleColor: '#f4f4f5',
  specBg: '#18181b',
  specBorder: 'rgba(255,255,255,0.06)',
  reasoningBg: 'color-mix(in srgb, var(--accent-lever) 10%, transparent)',
  textColor: '#d4d4d8',
  mutedColor: '#a1a1aa',
  faintColor: '#71717a',
  buttonBg: 'rgba(255,255,255,0.06)',
  buttonBorder: 'rgba(255,255,255,0.1)',
  buttonColor: '#a1a1aa',
  popoverBg: '#1e1e20',
  popoverBorder: 'rgba(255,255,255,0.1)',
}

interface ReasoningCardProps {
  materialId?: string
  materialType: string
  content: string   // The JSON spec as a string
  reasoning: string
  title: string
  darkMode?: boolean
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
              backgroundColor: tab === t ? 'color-mix(in srgb, var(--accent-lever) 10%, transparent)' : 'transparent',
              color: tab === t ? 'var(--accent-lever)' : '#a8a29e',
              border: tab === t ? '1px solid color-mix(in srgb, var(--accent-lever) 20%, transparent)' : '1px solid transparent',
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
                backgroundColor: dp.emphasis ? 'color-mix(in srgb, var(--accent-lever) 7%, transparent)' : 'rgba(0,0,0,0.04)',
                border: dp.emphasis ? '1px solid color-mix(in srgb, var(--accent-lever) 18%, transparent)' : '1px solid transparent',
              }}
            >
              <span className="text-sm" style={{ color: '#44403c' }}>{dp.label}</span>
              <span
                className="text-sm font-semibold flex-shrink-0"
                style={{ color: dp.emphasis ? 'var(--accent-lever)' : '#292524' }}
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
            style={{ color: 'var(--accent-lever)' }}
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
                  ? 'var(--accent-lever)'
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
          style={{ backgroundColor: 'color-mix(in srgb, var(--accent-lever) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-lever) 15%, transparent)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-lever)' }}>
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

export function ReasoningCard({ materialId, materialType, content, reasoning, title, darkMode = false }: ReasoningCardProps) {
  const rc = darkMode ? DARK_RC : LIGHT_RC
  const [copied, setCopied] = useState<string | false>(false)
  const [socialCopied, setSocialCopied] = useState<string | null>(null)
  const [showClaudeHint, setShowClaudeHint] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
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

  function handleDownloadMarkdown() {
    try {
      const parsed = JSON.parse(content) as CampaignMaterial
      const md = campaignSpecToMarkdown(
        materialType as CampaignMaterial['materialType'],
        parsed
      )
      const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `${materialType}-${date}.md`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch {
      // Fallback: download raw content as markdown
      const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${materialType}-${Date.now()}.md`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }
  }

  const handleDownloadPdf = useCallback(async () => {
    if (!materialId) return
    setPdfExporting(true)
    try {
      const res = await fetch('/api/campaign/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId, format: 'pdf' }),
      })
      if (!res.ok) throw new Error('PDF export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `${materialType}-${date}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      console.error('[reasoning-card] PDF export failed:', err)
    } finally {
      setPdfExporting(false)
    }
  }, [materialId, materialType])

  function handlePrint() {
    if (!materialId) return
    window.open(`/api/campaign/${materialId}/print`, '_blank')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied('Copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied('Failed')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Social copy helpers for social_post material type
  async function handleCopySocial(platform: 'twitter' | 'instagram') {
    try {
      const parsed = JSON.parse(content)
      const variations = (parsed.variations ?? []) as Array<{
        tone: string
        text: string
        characterCount: number
        hashtags: string[]
      }>

      if (variations.length === 0) return

      let variation: typeof variations[0]
      if (platform === 'twitter') {
        // Prefer 'factual' tone, fall back to first
        variation = variations.find((v) => v.tone === 'factual') ?? variations[0]
      } else {
        // Prefer 'comparison' tone, fall back to last
        variation = variations.find((v) => v.tone === 'comparison') ?? variations[variations.length - 1]
      }

      const hashtags = variation.hashtags.length > 0
        ? '\n\n' + variation.hashtags.map((h) => `#${h}`).join(' ')
        : ''
      const charNote = platform === 'twitter'
        ? `\n\n[${variation.characterCount} chars]`
        : ''
      const text = variation.text + hashtags + charNote

      await navigator.clipboard.writeText(text)
      setSocialCopied(platform)
      setTimeout(() => setSocialCopied(null), 2000)
    } catch {
      setSocialCopied('failed')
      setTimeout(() => setSocialCopied(null), 2000)
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${rc.border}` }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{
          backgroundColor: rc.headerBg,
          borderColor: rc.headerBorder,
        }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--accent-lever)' }}
          >
            {label}
          </p>
          <p className="mt-0.5 text-sm font-medium" style={{ color: rc.titleColor }}>{title}</p>
        </div>

        {/* Export actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={handleCopy}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: rc.buttonBg,
              color: rc.buttonColor,
              border: `1px solid ${rc.buttonBorder}`,
            }}
          >
            {copied || 'Copy JSON'}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
              color: 'var(--accent-lever)',
              border: '1px solid color-mix(in srgb, var(--accent-lever) 20%, transparent)',
            }}
          >
            Download JSON
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
              color: 'var(--accent-lever)',
              border: '1px solid color-mix(in srgb, var(--accent-lever) 20%, transparent)',
            }}
          >
            Download Markdown
          </button>
          {materialId && (
            <button
              onClick={handlePrint}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
                color: 'var(--accent-lever)',
                border: '1px solid color-mix(in srgb, var(--accent-lever) 20%, transparent)',
              }}
            >
              Print
            </button>
          )}
          {/* PDF download button for types with PDF templates */}
          {materialId && hasCampaignPdfTemplate(materialType) && (
            <button
              onClick={handleDownloadPdf}
              disabled={pdfExporting}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: pdfExporting ? 'color-mix(in srgb, var(--accent-lever) 4%, transparent)' : 'color-mix(in srgb, var(--accent-lever) 8%, transparent)',
                color: 'var(--accent-lever)',
                border: '1px solid color-mix(in srgb, var(--accent-lever) 20%, transparent)',
                opacity: pdfExporting ? 0.6 : 1,
              }}
            >
              {pdfExporting ? 'Generating PDF...' : 'Download PDF'}
            </button>
          )}
          {/* Social copy buttons for social_post type */}
          {materialType === 'social_post' && (
            <>
              <button
                onClick={() => handleCopySocial('twitter')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: rc.buttonBg,
                  color: rc.buttonColor,
                  border: `1px solid ${rc.buttonBorder}`,
                }}
              >
                {socialCopied === 'twitter' ? 'Copied' : socialCopied === 'failed' ? 'Failed' : 'Copy for X'}
              </button>
              <button
                onClick={() => handleCopySocial('instagram')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: rc.buttonBg,
                  color: rc.buttonColor,
                  border: `1px solid ${rc.buttonBorder}`,
                }}
              >
                {socialCopied === 'instagram' ? 'Copied' : socialCopied === 'failed' ? 'Failed' : 'Copy for Instagram'}
              </button>
            </>
          )}
          {/* Open in Claude — shows the Artifacts template instructions */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowClaudeHint((v) => !v)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-oracle) 10%, transparent)',
                color: 'var(--accent-oracle)',
                border: '1px solid color-mix(in srgb, var(--accent-oracle) 25%, transparent)',
              }}
              aria-label="Open in Claude — show instructions"
            >
              Open in Claude
            </button>
            {showClaudeHint && (
              <div
                className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl p-4 shadow-lg"
                style={{
                  backgroundColor: rc.popoverBg,
                  border: `1px solid ${rc.popoverBorder}`,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--accent-oracle)' }}>
                  Render in Claude Artifacts
                </p>
                <ol className="space-y-1.5 text-xs leading-relaxed" style={{ color: rc.textColor }}>
                  <li>1. Click <strong>Copy JSON</strong> above to copy your spec</li>
                  <li>2. Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-oracle)' }}>claude.ai</a> in a new tab</li>
                  <li>3. Use the prompt template from <code className="rounded px-1 py-0.5 text-[10px]" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: '#292524' }}>docs/claude-artifacts-template.md</code></li>
                  <li>4. Paste the template prompt, then your JSON at the end</li>
                </ol>
                <button
                  onClick={() => setShowClaudeHint(false)}
                  className="mt-3 text-[10px]"
                  style={{ color: rc.faintColor }}
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
            backgroundColor: rc.specBg,
            borderColor: rc.specBorder,
          }}
        >
          <p className="section-heading">Generated Spec</p>
          <SpecView materialType={materialType} spec={spec} />
        </div>

        {/* Right: Reasoning */}
        <div
          className="h-full px-6 py-6 min-h-[180px]"
          style={{ backgroundColor: rc.reasoningBg }}
        >
          <p className="section-heading">Why This Framing</p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: rc.textColor }}
          >
            {reasoning}
          </p>
        </div>
      </div>
    </div>
  )
}
