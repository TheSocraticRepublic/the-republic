'use client'

/**
 * InfographicPreview — Rendering spike (Phase 3C)
 *
 * Renders an InfographicSpec as a styled visual card layout using pure React.
 *
 * AntV @antv/infographic (v0.2.17) was evaluated and rejected:
 * - Pre-1.0 release with no stable React integration API
 * - No peer dependency on React — ships its own rendering pipeline
 * - Documentation covers canvas-based usage only, no JSX exports
 * The fallback pure React/SVG approach is used instead. It proves the pipeline
 * (spec → visual) without committing to an unstable library.
 *
 * Export strategy:
 * - "Download PNG" uses html-to-image (MIT, no deps) to rasterize the DOM node
 * - "Download SVG" wraps the node in a foreignObject SVG blob
 */

import { useRef, useState } from 'react'
import { toPng, toSvg } from 'html-to-image'

const EXPORT_ERROR_MSG = 'Export failed — try using Copy JSON instead'

export interface InfographicPreviewProps {
  spec: {
    title: string
    subtitle?: string
    dataPoints: Array<{ label: string; value: string | number; source: string; emphasis: boolean }>
    comparison?: { before: string; after: string; source: string }
    timeline?: Array<{ date: string; event: string }>
    callToAction: string
  }
}

// Find the max numeric value in dataPoints for bar scaling
function maxNumericValue(dataPoints: InfographicPreviewProps['spec']['dataPoints']): number {
  const nums = dataPoints
    .map((dp) => {
      const n = typeof dp.value === 'number' ? dp.value : parseFloat(String(dp.value).replace(/[^0-9.-]/g, ''))
      return isNaN(n) ? 0 : n
    })
  return Math.max(...nums, 1)
}

// Strip non-numeric suffix for bar width calculation (e.g. "42%" → 42)
function toBarWidth(value: string | number, max: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  if (isNaN(n) || max === 0) return 20
  return Math.max(6, Math.round((Math.abs(n) / max) * 100))
}

export function InfographicPreview({ spec }: InfographicPreviewProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState<'png' | 'svg' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  function showExportError() {
    setExportError(EXPORT_ERROR_MSG)
    setTimeout(() => setExportError(null), 3000)
  }

  const max = maxNumericValue(spec.dataPoints)

  async function handleDownloadPng() {
    if (!nodeRef.current || exporting) return
    setExporting('png')
    try {
      const dataUrl = await toPng(nodeRef.current, { cacheBust: true, pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `infographic-${Date.now()}.png`
      a.click()
    } catch {
      showExportError()
    } finally {
      setExporting(null)
    }
  }

  async function handleDownloadSvg() {
    if (!nodeRef.current || exporting) return
    setExporting('svg')
    try {
      const dataUrl = await toSvg(nodeRef.current, { cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `infographic-${Date.now()}.svg`
      a.click()
    } catch {
      showExportError()
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Export controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleDownloadPng}
          disabled={exporting !== null}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            color: '#78716c',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {exporting === 'png' ? 'Exporting...' : 'Download PNG'}
        </button>
        <button
          onClick={handleDownloadSvg}
          disabled={exporting !== null}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            color: '#78716c',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {exporting === 'svg' ? 'Exporting...' : 'Download SVG'}
        </button>
        {exportError && (
          <span className="text-xs" style={{ color: '#C85B5B' }}>
            {exportError}
          </span>
        )}
      </div>

      {/* Infographic card — this is the node captured by html-to-image */}
      <div
        ref={nodeRef}
        style={{
          backgroundColor: '#fafaf9',
          borderRadius: '16px',
          padding: '32px',
          fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
          maxWidth: '600px',
          border: '1px solid #e7e5e4',
        }}
      >
        {/* Title block */}
        <div style={{ marginBottom: '24px', borderBottom: '2px solid #C85B5B', paddingBottom: '16px' }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#C85B5B',
              marginBottom: '6px',
            }}
          >
            Campaign Material
          </p>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#1c1917',
              lineHeight: 1.2,
              marginBottom: spec.subtitle ? '6px' : 0,
            }}
          >
            {spec.title}
          </h2>
          {spec.subtitle && (
            <p style={{ fontSize: '13px', color: '#78716c', lineHeight: 1.4 }}>
              {spec.subtitle}
            </p>
          )}
        </div>

        {/* Data points — horizontal bar chart */}
        {spec.dataPoints.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#a8a29e',
                marginBottom: '12px',
              }}
            >
              Key Findings
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {spec.dataPoints.map((dp, i) => {
                const barPct = toBarWidth(dp.value, max)
                const accent = dp.emphasis ? '#C85B5B' : '#78716c'
                const barBg = dp.emphasis ? 'rgba(200,91,91,0.15)' : 'rgba(0,0,0,0.06)'
                return (
                  <div key={i}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#292524', fontWeight: dp.emphasis ? 600 : 400 }}>
                        {dp.label}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: accent,
                          marginLeft: '12px',
                          flexShrink: 0,
                        }}
                      >
                        {String(dp.value)}
                      </span>
                    </div>
                    {/* Bar */}
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        backgroundColor: barBg,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: '3px',
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '10px', color: '#a8a29e', marginTop: '2px' }}>{dp.source}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Comparison block */}
        {spec.comparison && (
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#a8a29e',
                marginBottom: '12px',
              }}
            >
              Before / After
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(200,91,91,0.07)',
                  border: '1px solid rgba(200,91,91,0.2)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#C85B5B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Before
                </p>
                <p style={{ fontSize: '12px', color: '#44403c', lineHeight: 1.45 }}>{spec.comparison.before}</p>
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(91,200,138,0.07)',
                  border: '1px solid rgba(91,200,138,0.2)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}
              >
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#5bc88a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  After
                </p>
                <p style={{ fontSize: '12px', color: '#44403c', lineHeight: 1.45 }}>{spec.comparison.after}</p>
              </div>
            </div>
            {spec.comparison.source && (
              <p style={{ fontSize: '10px', color: '#a8a29e', marginTop: '6px' }}>
                Source: {spec.comparison.source}
              </p>
            )}
          </div>
        )}

        {/* Timeline block */}
        {spec.timeline && spec.timeline.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#a8a29e',
                marginBottom: '12px',
              }}
            >
              Timeline
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {spec.timeline.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px' }}>
                  {/* Connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#C85B5B',
                        marginTop: '4px',
                        flexShrink: 0,
                      }}
                    />
                    {i < (spec.timeline?.length ?? 0) - 1 && (
                      <div style={{ width: '1px', flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', marginTop: '2px', minHeight: '16px' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#a8a29e', fontWeight: 600 }}>{item.date}</p>
                    <p style={{ fontSize: '12px', color: '#292524' }}>{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to action */}
        <div
          style={{
            backgroundColor: 'rgba(200,91,91,0.06)',
            border: '1px solid rgba(200,91,91,0.18)',
            borderRadius: '10px',
            padding: '14px 16px',
          }}
        >
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#C85B5B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Call to Action
          </p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#292524', lineHeight: 1.4 }}>
            {spec.callToAction}
          </p>
        </div>
      </div>
    </div>
  )
}
