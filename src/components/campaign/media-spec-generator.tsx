'use client'

import { useState } from 'react'
import { MATERIAL_TYPE_LABELS } from '@/lib/campaign/schemas'

type Audience = 'general_public' | 'decision_maker' | 'media' | 'legal'

const AUDIENCE_LABELS: Record<Audience, string> = {
  general_public: 'General Public',
  decision_maker: 'Decision Makers',
  media: 'Media',
  legal: 'Legal',
}

interface GeneratedMaterial {
  id: string
  content: string
  reasoning: string
}

interface MediaSpecGeneratorProps {
  investigationId: string
  materialType: string
  onGenerated: (material: GeneratedMaterial) => void
  onCancel: () => void
}

export function MediaSpecGenerator({
  investigationId,
  materialType,
  onGenerated,
  onCancel,
}: MediaSpecGeneratorProps) {
  const [audience, setAudience] = useState<Audience>('general_public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = MATERIAL_TYPE_LABELS[materialType as keyof typeof MATERIAL_TYPE_LABELS] ?? materialType

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/investigate/${investigationId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialType, audience }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Generation failed (${res.status})`)
        setLoading(false)
        return
      }

      const data = await res.json()
      // The endpoint returns { id, createdAt, spec } — spec contains the full parsed material
      // We expose id, content (re-serialized spec), and reasoning to the caller
      onGenerated({
        id: data.id,
        content: JSON.stringify(data.spec),
        reasoning: data.spec.reasoning ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-5"
      style={{
        backgroundColor: 'rgba(200, 91, 91, 0.04)',
        borderColor: 'rgba(200, 91, 91, 0.18)',
      }}
    >
      {/* Type label */}
      <div className="space-y-0.5">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: '#C85B5B' }}
        >
          Generate
        </p>
        <p className="text-sm font-medium" style={{ color: '#e2e0de' }}>{label}</p>
      </div>

      {/* Audience selector */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Target Audience
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C85B5B]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950"
              style={{
                backgroundColor: audience === a
                  ? 'rgba(200, 91, 91, 0.18)'
                  : 'rgba(255,255,255,0.04)',
                color: audience === a ? '#C85B5B' : '#71717a',
                border: audience === a
                  ? '1px solid rgba(200, 91, 91, 0.35)'
                  : '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {AUDIENCE_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg px-4 py-3 space-y-2" style={{ backgroundColor: 'rgba(200,91,91,0.08)', border: '1px solid rgba(200,91,91,0.2)' }}>
          <p className="text-xs" style={{ color: '#C85B5B' }}>{error}</p>
          <button
            onClick={handleGenerate}
            className="text-xs underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C85B5B]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950"
            style={{ color: '#C85B5B' }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C85B5B]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950"
          style={{
            backgroundColor: loading ? 'rgba(200,91,91,0.12)' : 'rgba(200, 91, 91, 0.18)',
            color: '#C85B5B',
            border: '1px solid rgba(200, 91, 91, 0.3)',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <span
                className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
              />
              Generating
            </>
          ) : (
            'Generate'
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C85B5B]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
