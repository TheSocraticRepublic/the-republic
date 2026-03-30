'use client'

import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
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
    <div className="flex flex-col items-start max-w-[80%]">
      <div
        className="rounded-xl rounded-tl-sm border px-4 py-3"
        style={{
          borderColor: 'rgba(200, 168, 75, 0.2)',
          backgroundColor: 'rgba(200, 168, 75, 0.05)',
          borderLeftWidth: '2px',
          borderLeftColor: '#C8A84B',
        }}
      >
        <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span
              className="ml-0.5 inline-block h-3.5 w-0.5 align-middle animate-pulse"
              style={{ backgroundColor: '#C8A84B' }}
            />
          )}
        </p>
      </div>
      {questionType && QUESTION_TYPE_LABELS[questionType] && (
        <span className="mt-1 text-[10px] text-neutral-600 uppercase tracking-widest px-1">
          {QUESTION_TYPE_LABELS[questionType]}
        </span>
      )}
      {insights?.map((ins) => (
        <InsightBadge key={ins.id} insight={ins.insight} />
      ))}
    </div>
  )
}

function CitizenMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[80%] rounded-xl rounded-tr-sm border px-4 py-3"
        style={{
          borderColor: 'rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">{content}</p>
      </div>
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
          <p className="text-sm text-neutral-500">
            The inquiry begins when you speak.
          </p>
          <p className="mt-1 text-xs text-neutral-600">
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
