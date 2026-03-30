'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { MessageCircleQuestion } from 'lucide-react'
import { ChatThread } from './chat-thread'
import { ChatInput } from './chat-input'
import { SessionStats } from './session-stats'

interface Turn {
  id: string
  role: 'gadfly' | 'citizen'
  content: string
  questionType?: string | null
  turnIndex: number
  createdAt: Date | string
}

interface InsightMarker {
  id: string
  turnId: string
  insight: string
}

interface Session {
  id: string
  title: string
  mode: 'socratic' | 'direct'
  status: 'active' | 'completed' | 'abandoned'
  questionCount: number
  insightCount: number
  complexityLevel: number
}

interface GadflySessionProps {
  session: Session
  initialTurns: Turn[]
  initialInsightsByTurn: Record<string, InsightMarker[]>
  questionTypeCounts: Record<string, number>
}

export function GadflySession({
  session,
  initialTurns,
  initialInsightsByTurn,
  questionTypeCounts: initialQuestionTypeCounts,
}: GadflySessionProps) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns)
  const [insightsByTurn, setInsightsByTurn] = useState<Record<string, InsightMarker[]>>(initialInsightsByTurn)
  const [questionTypeCounts, setQuestionTypeCounts] = useState<Record<string, number>>(initialQuestionTypeCounts)
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [questionCount, setQuestionCount] = useState(session.questionCount)
  const [insightCount, setInsightCount] = useState(session.insightCount)

  const handleSubmit = useCallback(async (content: string) => {
    if (isStreaming) return

    // Optimistically add citizen turn to UI
    const citizenTurn: Turn = {
      id: `temp-${Date.now()}`,
      role: 'citizen',
      content,
      turnIndex: turns.length,
      createdAt: new Date(),
    }
    setTurns((prev) => [...prev, citizenTurn])
    setIsStreaming(true)
    setStreamingContent('')

    try {
      const res = await fetch('/api/gadfly/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, content }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[gadfly] Turn failed:', data.error)
        setIsStreaming(false)
        return
      }

      if (!res.body) {
        setIsStreaming(false)
        return
      }

      // Read the text stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingContent(accumulated)
      }

      // Stream complete — add gadfly turn to local state and re-fetch updated data
      setIsStreaming(false)
      setStreamingContent('')

      // Fetch updated session data (new turns + any new insights)
      try {
        const sessionRes = await fetch(`/api/gadfly/session/${session.id}`)
        if (sessionRes.ok) {
          const data = await sessionRes.json()
          setTurns(data.turns ?? [])
          setInsightsByTurn(data.insightsByTurn ?? {})
          setQuestionCount(data.session?.questionCount ?? questionCount + 1)
          setInsightCount(data.session?.insightCount ?? insightCount)

          // Rebuild question type counts
          const newCounts: Record<string, number> = {}
          for (const t of (data.turns ?? []) as Turn[]) {
            if (t.role === 'gadfly' && t.questionType) {
              newCounts[t.questionType] = (newCounts[t.questionType] ?? 0) + 1
            }
          }
          setQuestionTypeCounts(newCounts)
        }
      } catch {
        // Non-fatal — UI is still consistent with streamed content
      }
    } catch (err) {
      console.error('[gadfly] Stream error:', err)
      setIsStreaming(false)
      setStreamingContent('')
    }
  }, [isStreaming, turns.length, session.id, questionCount, insightCount])

  const isActive = session.status === 'active'

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/gadfly"
              className="flex-shrink-0 text-neutral-500 transition-colors hover:text-neutral-300 text-xs"
            >
              ← All inquiries
            </Link>
            <span className="text-neutral-700">·</span>
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border"
              style={{
                borderColor: 'rgba(200, 168, 75, 0.2)',
                backgroundColor: 'rgba(200, 168, 75, 0.07)',
              }}
            >
              <MessageCircleQuestion size={13} strokeWidth={1.75} style={{ color: '#C8A84B' }} />
            </span>
            <h1
              className="truncate text-sm font-semibold text-neutral-200"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              {session.title}
            </h1>
          </div>

          {/* Mode badge */}
          <span
            className="ml-4 flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{
              color: '#C8A84B',
              backgroundColor: 'rgba(200, 168, 75, 0.1)',
            }}
          >
            {session.mode}
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex flex-1 flex-col min-w-0">
          <ChatThread
            turns={turns}
            insightsByTurn={insightsByTurn}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />

          {/* Input */}
          <div className="flex-shrink-0 border-t border-white/[0.06] p-4">
            {isActive ? (
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                disabled={isStreaming}
              />
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-3 text-center text-xs text-neutral-500">
                This inquiry is {session.status}. Start a new inquiry to continue.
              </div>
            )}
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="flex-shrink-0 w-64 border-l border-white/[0.06] p-4">
          <SessionStats
            questionCount={questionCount}
            insightCount={insightCount}
            complexityLevel={session.complexityLevel}
            questionTypeCounts={questionTypeCounts}
          />
        </div>
      </div>
    </div>
  )
}
