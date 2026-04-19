'use client'

import { useState, useEffect, useRef } from 'react'
import { PlayerCard } from './player-card'
import { HistoricalContext } from './historical-context'
import { GadflyEntry } from './gadfly-entry'

interface Player {
  playerId: string
  name: string
  playerType: string
  description: string | null
  metadata: Record<string, unknown> | null
  role: string
  context: string | null
}

interface LensPanelProps {
  investigationId: string
  concern: string
  jurisdictionName?: string | null
  briefingText: string
  onOpenGadfly: () => void
}

export function LensPanel({
  investigationId,
  concern,
  jurisdictionName: _jurisdictionName,
  briefingText: _briefingText,
  onOpenGadfly,
}: LensPanelProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [historicalContent, setHistoricalContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [deepenError, setDeepenError] = useState(false)
  const deepenStarted = useRef(false)
  const pollCountRef = useRef(0)

  // 1. Stream historical context from POST /api/investigate/[id]/deepen
  useEffect(() => {
    if (deepenStarted.current) return
    deepenStarted.current = true

    const controller = new AbortController()

    async function streamDeepen() {
      setIsStreaming(true)
      try {
        const res = await fetch(`/api/investigate/${investigationId}/deepen`, {
          method: 'POST',
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          setDeepenError(true)
          setIsStreaming(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setHistoricalContent(accumulated)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('[LensPanel] deepen stream error:', err)
        setDeepenError(true)
      } finally {
        setIsStreaming(false)
      }
    }

    streamDeepen()

    return () => {
      controller.abort()
    }
  }, [investigationId])

  // 2. Poll GET /api/investigate/[id]/players (every 3s, up to 15s)
  useEffect(() => {
    const maxPolls = 5 // 5 * 3s = 15s
    pollCountRef.current = 0
    const cancelled = { current: false }

    async function fetchPlayers() {
      if (cancelled.current) return
      if (pollCountRef.current >= maxPolls) return

      try {
        const res = await fetch(`/api/investigate/${investigationId}/players`)
        if (res.ok) {
          const data = await res.json()
          const fetched: Player[] = data.players ?? []
          if (fetched.length > 0) {
            if (!cancelled.current) setPlayers(fetched)
            return // stop polling once we have data
          }
        }
      } catch {
        // Non-fatal
      }

      pollCountRef.current += 1

      if (!cancelled.current && pollCountRef.current < maxPolls) {
        setTimeout(fetchPlayers, 3000)
      }
    }

    // Start first poll after a small delay (extraction is triggered by deepen)
    const timer = setTimeout(fetchPlayers, 2000)
    return () => {
      cancelled.current = true
      clearTimeout(timer)
    }
  }, [investigationId])

  return (
    <div className="space-y-8 pt-2">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: '#C8A84B' }}
        >
          Deeper Layer
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />
      </div>

      {/* Player profiles */}
      <section>
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Key Players
        </p>
        {players.length === 0 ? (
          <div
            className="rounded-xl border px-5 py-4"
            style={{
              borderColor: 'rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(255,255,255,0.015)',
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: '#a3a3a3' }}
              />
              <p className="text-xs text-neutral-600">Identifying players from the briefing</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible">
            {players.map((player) => (
              <PlayerCard
                key={player.playerId}
                name={player.name}
                playerType={player.playerType}
                role={player.role}
                context={player.context}
                description={player.description}
              />
            ))}
          </div>
        )}
      </section>

      {/* Historical context */}
      <section>
        {deepenError ? (
          <div
            className="rounded-2xl p-8"
            style={{ backgroundColor: '#f8f6f3' }}
          >
            <p className="text-sm" style={{ color: '#78716c' }}>
              Could not load historical context. Refresh to try again.
            </p>
          </div>
        ) : (
          <HistoricalContext content={historicalContent} isStreaming={isStreaming} />
        )}
      </section>

      {/* Gadfly entry */}
      <section>
        <GadflyEntry
          investigationId={investigationId}
          concern={concern}
          onOpenGadfly={onOpenGadfly}
        />
      </section>
    </div>
  )
}
