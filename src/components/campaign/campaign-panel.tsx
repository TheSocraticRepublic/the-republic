'use client'

import { useState, useEffect, useRef } from 'react'
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_DESCRIPTIONS } from '@/lib/campaign/schemas'
import { MediaSpecGenerator } from './media-spec-generator'
import { ReasoningCard } from './reasoning-card'
import { OutcomeTracker } from './outcome-tracker'

interface CampaignPanelProps {
  investigationId: string
  concern: string
  jurisdictionName?: string | null
}

interface SavedMaterial {
  id: string
  materialType: string
  title: string
  content: string
  reasoning: string
  createdAt: string
}

const MATERIAL_TYPES = Object.keys(MATERIAL_TYPE_LABELS) as Array<keyof typeof MATERIAL_TYPE_LABELS>

export function CampaignPanel({ investigationId, concern: _, jurisdictionName: _j }: CampaignPanelProps) {
  const [materials, setMaterials] = useState<SavedMaterial[]>([])
  const [activeMaterialType, setActiveMaterialType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const initStarted = useRef(false)

  // Initialize campaign (POST) and fetch existing materials (GET)
  useEffect(() => {
    if (initStarted.current) return
    initStarted.current = true

    async function init() {
      try {
        // Fire-and-forget: mark campaignOpenedAt — ignore result
        fetch(`/api/investigate/${investigationId}/action`, { method: 'POST' }).catch(() => {})

        const res = await fetch(`/api/investigate/${investigationId}/action`)
        if (res.ok) {
          const data = await res.json()
          const deduped = Object.values(
            (data.materials ?? []).reduce((acc: Record<string, any>, m: any) => {
              if (!acc[m.materialType] || m.createdAt > acc[m.materialType].createdAt) {
                acc[m.materialType] = m
              }
              return acc
            }, {})
          )
          setMaterials(deduped as SavedMaterial[])
        }
      } catch {
        // Non-fatal — user can still generate
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [investigationId])

  function handleGenerated(result: { id: string; content: string; reasoning: string }) {
    if (!activeMaterialType) return

    // Find the title from the parsed content
    let title = MATERIAL_TYPE_LABELS[activeMaterialType as keyof typeof MATERIAL_TYPE_LABELS]
    try {
      const parsed = JSON.parse(result.content)
      if (parsed.title) title = parsed.title
    } catch {
      // Use label as fallback
    }

    const newMaterial: SavedMaterial = {
      id: result.id,
      materialType: activeMaterialType,
      title,
      content: result.content,
      reasoning: result.reasoning,
      createdAt: new Date().toISOString(),
    }

    setMaterials((prev) => {
      // Replace any existing material of this type (re-generate replaces)
      const without = prev.filter((m) => m.materialType !== activeMaterialType)
      return [newMaterial, ...without]
    })
    setActiveMaterialType(null)
  }

  return (
    <div className="space-y-8 pt-2">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#C85B5B' }}
        >
          Campaign Materials
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Material type grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MATERIAL_TYPES.map((type) => {
          const existing = materials.find((m) => m.materialType === type)
          const isGenerating = activeMaterialType === type

          return (
            <div
              key={type}
              className="rounded-xl border px-5 py-4 space-y-3"
              style={{
                backgroundColor: isGenerating
                  ? 'rgba(200, 91, 91, 0.04)'
                  : 'rgba(255, 255, 255, 0.025)',
                borderColor: isGenerating
                  ? 'rgba(200, 91, 91, 0.25)'
                  : existing
                  ? 'rgba(200, 91, 91, 0.15)'
                  : 'rgba(255, 255, 255, 0.07)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold" style={{ color: '#e2e0de' }}>
                    {MATERIAL_TYPE_LABELS[type]}
                  </p>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    {MATERIAL_TYPE_DESCRIPTIONS[type]}
                  </p>
                </div>
                {existing && !isGenerating && (
                  <span
                    className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                    style={{ backgroundColor: 'rgba(200,91,91,0.12)', color: '#C85B5B' }}
                  >
                    Done
                  </span>
                )}
              </div>

              {!isGenerating && (
                <button
                  onClick={() => setActiveMaterialType(type)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-100"
                  style={{
                    backgroundColor: existing
                      ? 'rgba(200, 91, 91, 0.08)'
                      : 'rgba(200, 91, 91, 0.12)',
                    color: '#C85B5B',
                    border: '1px solid rgba(200, 91, 91, 0.2)',
                  }}
                >
                  {existing ? 'Regenerate' : 'Generate'}
                </button>
              )}

              {isGenerating && (
                <MediaSpecGenerator
                  investigationId={investigationId}
                  materialType={type}
                  onGenerated={handleGenerated}
                  onCancel={() => setActiveMaterialType(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          <div className="h-4 w-1/3 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <div className="h-4 w-2/3 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </div>
      )}

      {/* Generated materials */}
      {materials.length > 0 && (
        <section className="space-y-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
            Generated Materials
          </p>
          {materials.map((material) => (
            <ReasoningCard
              key={material.id}
              materialType={material.materialType}
              content={material.content}
              reasoning={material.reasoning}
              title={material.title}
            />
          ))}
        </section>
      )}

      {/* Outcome tracker */}
      {materials.length > 0 && (
        <OutcomeTracker
          investigationId={investigationId}
          materials={materials.map((m) => ({
            id: m.id,
            materialType: m.materialType,
            title: m.title,
            createdAt: m.createdAt,
          }))}
        />
      )}
    </div>
  )
}
