'use client'

import { useEffect, useRef } from 'react'
import { InsightBadge } from './insight-badge'

interface Turn {
  id: string
  role: 'gadfly' | 'citizen'
  content: string
  questionType?: string | null
  turnIndex: number
}

interface InsightMarker {
  id: string
  turnId: string
  insight: string
}

interface ChatThreadProps {
  turns: Turn[]
  insightsByTurn: Record<string, InsightMarker[]>
  streamingContent?: string
  isStreaming?: boolean
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  clarifying: 'Clarifying',
  probing: 'Probing',
  challenging: 'Challenging',
  connecting: 'Connecting',
  action: 'Action',
}

function GadflyMessage({
  content,
  questionType,
  insights,
  isStreaming = false,
}: {
  content: string
  questionType?: string | null
  insights?: InsightMarker[]
  isStreaming?: boolean
}) {
  return (
    <div
      className="relative w-full"
      style={{
        paddingLeft: '1rem',
        borderLeft: '3px solid var(--accent-gadfly)',
      }}
    >
      {questionType && QUESTION_TYPE_LABELS[questionType] && (
        <span
          className="absolute right-0 top-0 text-[10px] uppercase tracking-widest"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--accent-gadfly)',
            opacity: 0.5,
          }}
        >
          {QUESTION_TYPE_LABELS[questionType]}
        </span>
      )}
      <p
        className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap italic"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {content}
        {isStreaming && (
          <span
            className="ml-0.5 inline-block h-3.5 w-0.5 align-middle animate-pulse"
            style={{ backgroundColor: 'var(--accent-gadfly)' }}
          />
        )}
      </p>
      {insights?.map((ins) => (
        <InsightBadge key={ins.id} insight={ins.insight} />
      ))}
    </div>
  )
}

function CitizenMessage({ content }: { content: string }) {
  return (
    <div
      className="w-full rounded-lg px-4 py-2"
      style={{ backgroundColor: 'color-mix(in srgb, var(--surface-2) 50%, transparent)' }}
    >
      <p
        className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {content}
      </p>
    </div>
  )
}

export function ChatThread({
  turns,
  insightsByTurn,
  streamingContent,
  isStreaming = false,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, streamingContent])

  if (turns.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="text-center">
          <p className="text-sm text-text-muted">
            The inquiry begins when you speak.
          </p>
          <p className="mt-1 text-xs text-text-faint">
            What do you notice about this document?
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
      {turns.map((turn) => {
        if (turn.role === 'gadfly') {
          return (
            <GadflyMessage
              key={turn.id}
              content={turn.content}
              questionType={turn.questionType}
              insights={insightsByTurn[turn.id]}
            />
          )
        }
        return <CitizenMessage key={turn.id} content={turn.content} />
      })}

      {/* Streaming gadfly response */}
      {isStreaming && streamingContent !== undefined && (
        <GadflyMessage
          content={streamingContent}
          isStreaming
        />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
