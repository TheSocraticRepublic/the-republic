'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { PlayerCard, type PlayerAppearance, type RelatedPlayer } from './player-card'
import { HistoricalContext } from './historical-context'
import { IssueTimeline } from './issue-timeline'
import { GadflyEntry } from './gadfly-entry'

interface TimelineEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  eventDate: string
  status: string
}

interface Player {
  playerId: string
  name: string
  playerType: string
  description: string | null
  metadata: Record<string, unknown> | null
  role: string
  context: string | null
}

const LIGHT_MARGIN = {
  bg: '#f5f4f3',
  cardBg: '#ffffff',
  cardBgHover: '#eeece8',
  border: '#e0ddd9',
  text: '#1c1917',
  secondary: '#44403c',
  muted: '#78716c',
  faint: '#a8a29e',
}

const DARK_MARGIN = {
  bg: '#18181b',
  cardBg: '#1e1e20',
  cardBgHover: '#27272a',
  border: 'rgba(255,255,255,0.1)',
  text: '#f4f4f5',
  secondary: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#71717a',
}

interface LensPanelProps {
  investigationId: string
  concern: string
  jurisdictionName?: string | null
  briefingText: string
  lensContextText?: string | null
  gadflySeededQuestion?: string | null
  onOpenGadfly: () => void
  darkMode?: boolean
}

export function LensPanel({
  investigationId,
  concern,
  jurisdictionName: _jurisdictionName,
  briefingText: _briefingText,
  lensContextText,
  gadflySeededQuestion,
  onOpenGadfly,
  darkMode = false,
}: LensPanelProps) {
  const palette = darkMode ? DARK_MARGIN : LIGHT_MARGIN
  const [players, setPlayers] = useState<Player[]>([])
  const [historicalContent, setHistoricalContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [deepenError, setDeepenError] = useState(false)
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [playerAppearances, setPlayerAppearances] = useState<Record<string, PlayerAppearance[]>>({})
  const [playerRelationships, setPlayerRelationships] = useState<Record<string, string[]>>({})
  const [enrichmentLoaded, setEnrichmentLoaded] = useState(false)
  const deepenStarted = useRef(false)
  const pollCountRef = useRef(0)

  // 1. Stream historical context from POST /api/investigate/[id]/deepen
  useEffect(() => {
    if (deepenStarted.current) return
    deepenStarted.current = true

    // If persisted context exists, render it instantly without re-streaming
    if (lensContextText) {
      setHistoricalContent(lensContextText)
      return
    }

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

  // Derive seeded question: DB-persisted prop takes priority, parsed from stream as fallback
  const parsedSeededQuestion = useMemo(() => {
    if (!historicalContent) return null
    const match = historicalContent.match(/## The Deeper Question\s*\n+([\s\S]*?)(?=\n## |$)/)
    const extracted = match?.[1]?.trim() || null
    if (extracted?.startsWith('#')) return null
    return extracted
  }, [historicalContent])

  const resolvedSeededQuestion = gadflySeededQuestion || parsedSeededQuestion

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

  // 3. Fetch timeline events
  useEffect(() => {
    fetch(`/api/investigate/${investigationId}/timeline`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => setTimelineEvents(data.events ?? []))
      .catch(() => {})
  }, [investigationId])

  const handleTogglePlayer = useCallback(
    async (playerId: string) => {
      if (expandedPlayerId === playerId) {
        setExpandedPlayerId(null)
        return
      }
      setExpandedPlayerId(playerId)

      if (!enrichmentLoaded) {
        try {
          const res = await fetch(
            `/api/investigate/${investigationId}/players?expand=true`
          )
          if (res.ok) {
            const data = await res.json()
            setPlayerAppearances(data.appearances ?? {})
            setPlayerRelationships(data.relationships ?? {})
            setEnrichmentLoaded(true)
          }
        } catch {
          // Non-fatal
        }
      }
    },
    [expandedPlayerId, enrichmentLoaded, investigationId]
  )

  const handleEventAdded = useCallback((event: TimelineEvent) => {
    setTimelineEvents((prev) =>
      [...prev, event].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    )
  }, [])

  return (
    <div
      className="rounded-xl overflow-hidden max-w-3xl mx-auto"
      style={{
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        borderTop: '2px solid #C8A84B',
        padding: 'clamp(24px, 4vw, 32px)',
      }}
    >
      <div className="space-y-8">
      {/* Section label */}
      <p
        style={{
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: '#C8A84B',
          margin: 0,
        }}
      >
        The Lens
      </p>

      {/* Player profiles */}
      <section>
        <p
          className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: palette.faint }}
        >
          Key Players
        </p>
        {players.length === 0 ? (
          <div
            className="rounded-xl px-5 py-4"
            style={{
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.cardBg,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: palette.faint }}
              />
              <p className="text-xs" style={{ color: palette.faint }}>Identifying players from the briefing</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible">
            {players.map((player) => {
              const isExpanded = expandedPlayerId === player.playerId
              const relatedPlayerIds = playerRelationships[player.playerId] ?? []
              const relatedPlayerData: RelatedPlayer[] = relatedPlayerIds
                .map((rpId) => {
                  const rp = players.find((p) => p.playerId === rpId)
                  if (!rp) return null
                  return {
                    playerId: rp.playerId,
                    name: rp.name,
                    playerType: rp.playerType,
                    role: rp.role,
                  }
                })
                .filter((rp): rp is RelatedPlayer => rp !== null)

              return (
                <PlayerCard
                  key={player.playerId}
                  name={player.name}
                  playerType={player.playerType}
                  role={player.role}
                  context={player.context}
                  description={player.description}
                  expanded={isExpanded}
                  onToggle={() => handleTogglePlayer(player.playerId)}
                  appearances={playerAppearances[player.playerId]}
                  relatedPlayers={relatedPlayerData}
                  darkMode={darkMode}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Historical context */}
      <section>
        {deepenError ? (
          <div
            className="rounded-2xl p-8"
            style={{ backgroundColor: darkMode ? palette.cardBg : '#f8f6f3' }}
          >
            <p className="text-sm" style={{ color: palette.muted }}>
              Could not load historical context. Refresh to try again.
            </p>
          </div>
        ) : (
          <HistoricalContext content={historicalContent} isStreaming={isStreaming} />
        )}
      </section>

      {/* Issue timeline */}
      <section>
        <IssueTimeline
          investigationId={investigationId}
          events={timelineEvents}
          onEventAdded={handleEventAdded}
          darkMode={darkMode}
        />
      </section>

      {/* Gadfly entry */}
      <section>
        <GadflyEntry
          investigationId={investigationId}
          concern={concern}
          seededQuestion={resolvedSeededQuestion}
          onOpenGadfly={onOpenGadfly}
          darkMode={darkMode}
        />
      </section>
      </div>
    </div>
  )
}
