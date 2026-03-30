'use client'

import Link from 'next/link'
import { MessageCircleQuestion } from 'lucide-react'

interface SessionCardProps {
  id: string
  title: string
  mode: 'socratic' | 'direct'
  status: 'active' | 'completed' | 'abandoned'
  questionCount: number
  insightCount: number
  createdAt: Date | string
  updatedAt: Date | string
}

const MODE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  socratic: { label: 'Socratic', color: '#C8A84B', bg: 'rgba(200, 168, 75, 0.12)' },
  direct: { label: 'Direct', color: '#89B4C8', bg: 'rgba(137, 180, 200, 0.12)' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#5BC88A', bg: 'rgba(91, 200, 138, 0.12)' },
  completed: { label: 'Completed', color: '#a3a3a3', bg: 'rgba(163, 163, 163, 0.12)' },
  abandoned: { label: 'Abandoned', color: '#C85B5B', bg: 'rgba(200, 91, 91, 0.12)' },
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SessionCard({
  id,
  title,
  mode,
  status,
  questionCount,
  insightCount,
  createdAt,
  updatedAt,
}: SessionCardProps) {
  const modeStyle = MODE_LABELS[mode] ?? MODE_LABELS.socratic
  const statusStyle = STATUS_LABELS[status] ?? STATUS_LABELS.active

  return (
    <Link
      href={`/gadfly/${id}`}
      className="block rounded-xl border border-white/[0.08] bg-black/60 backdrop-blur-md p-4 transition-all duration-150 hover:border-white/[0.15] hover:bg-black/70"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border"
          style={{
            borderColor: 'rgba(200, 168, 75, 0.2)',
            backgroundColor: 'rgba(200, 168, 75, 0.07)',
          }}
        >
          <MessageCircleQuestion size={14} strokeWidth={1.75} style={{ color: '#C8A84B' }} />
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-sm font-medium text-neutral-200 leading-snug"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {title}
          </p>

          {/* Badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{ color: modeStyle.color, backgroundColor: modeStyle.bg }}
            >
              {modeStyle.label}
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium"
              style={{ color: statusStyle.color, backgroundColor: statusStyle.bg }}
            >
              {statusStyle.label}
            </span>
          </div>

          {/* Counts + date */}
          <div className="mt-2.5 flex items-center gap-4 text-[11px] text-neutral-500">
            <span>{questionCount} {questionCount === 1 ? 'question' : 'questions'}</span>
            {insightCount > 0 && (
              <span style={{ color: '#C8A84B' }}>
                {insightCount} {insightCount === 1 ? 'insight' : 'insights'}
              </span>
            )}
            <span className="ml-auto">{formatDate(updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
