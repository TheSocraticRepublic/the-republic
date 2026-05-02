'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface QuestionTypeCounts {
  clarifying: number
  probing: number
  challenging: number
  connecting: number
  action: number
}

interface SessionStatsProps {
  questionCount: number
  insightCount: number
  complexityLevel: number
  questionTypeCounts?: Partial<QuestionTypeCounts>
}

const QUESTION_TYPE_COLORS: Record<string, string> = {
  clarifying: '#89B4C8',
  probing: '#C8A84B',
  challenging: '#C85B5B',
  connecting: '#5BC88A',
  action: '#a78bfa',
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  clarifying: 'Clarifying',
  probing: 'Probing',
  challenging: 'Challenging',
  connecting: 'Connecting',
  action: 'Action',
}

export function SessionStats({
  questionCount,
  insightCount,
  complexityLevel,
  questionTypeCounts = {},
}: SessionStatsProps) {
  const [expanded, setExpanded] = useState(false)

  const totalTyped = Object.values(questionTypeCounts).reduce((sum, n) => sum + (n ?? 0), 0)

  return (
    <div className="rounded-xl border border-border bg-surface-1 shadow-sm">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-1"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Session Stats
        </span>
        {expanded ? (
          <ChevronDown size={13} strokeWidth={2} className="text-text-faint" />
        ) : (
          <ChevronRight size={13} strokeWidth={2} className="text-text-faint" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-faint">Questions</p>
              <p className="mt-1 text-xl font-bold text-text-primary">{questionCount}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-faint">Insights</p>
              <p className="mt-1 text-xl font-bold" style={{ color: '#C8A84B' }}>
                {insightCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-text-faint">Complexity</p>
              <div className="mt-1 flex items-end gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-2 rounded-sm"
                    style={{
                      height: `${8 + i * 3}px`,
                      backgroundColor:
                        i < complexityLevel
                          ? '#C8A84B'
                          : 'var(--surface-3)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Question type distribution */}
          {totalTyped > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-text-faint">
                Question Types
              </p>
              <div className="space-y-1.5">
                {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => {
                  const count = questionTypeCounts[type as keyof QuestionTypeCounts] ?? 0
                  if (count === 0) return null
                  const pct = Math.round((count / totalTyped) * 100)
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className="w-16 text-[10px] text-text-muted">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: QUESTION_TYPE_COLORS[type] ?? '#C8A84B',
                          }}
                        />
                      </div>
                      <span className="w-5 text-right text-[10px] text-text-faint">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
