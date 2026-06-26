'use client'

import { useState } from 'react'

interface TimelineEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  eventDate: string
  status: string
}

const LIGHT_TL = {
  bg: '#ffffff',
  border: '#e0ddd9',
  text: '#1c1917',
  secondary: '#44403c',
  muted: '#78716c',
  faint: '#a8a29e',
  line: 'rgba(28, 25, 23, 0.06)',
}

const DARK_TL = {
  bg: '#1e1e20',
  border: 'rgba(255,255,255,0.1)',
  text: '#f4f4f5',
  secondary: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#71717a',
  line: 'rgba(255, 255, 255, 0.06)',
}

interface IssueTimelineProps {
  investigationId: string
  events: TimelineEvent[]
  onEventAdded?: (event: TimelineEvent) => void
  darkMode?: boolean
}

const EVENT_TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  deadline: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  comment_period: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  meeting: { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  decision: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  custom: { color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)' },
}

function getDotColor(eventType: string): string {
  return EVENT_TYPE_STYLES[eventType]?.color ?? EVENT_TYPE_STYLES.custom.color
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function IssueTimeline({ investigationId, events, onEventAdded, darkMode = false }: IssueTimelineProps) {
  const tl = darkMode ? DARK_TL : LIGHT_TL
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formType, setFormType] = useState('custom')
  const [formDescription, setFormDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formDate) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/investigate/${investigationId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: formType,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          eventDate: formDate,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onEventAdded?.({ ...data.event, description: data.event.description ?? null })
        setFormTitle('')
        setFormDate('')
        setFormType('custom')
        setFormDescription('')
        setShowForm(false)
      }
    } catch {
      // Non-fatal
    } finally {
      setSubmitting(false)
    }
  }

  if (events.length === 0 && !showForm) {
    return (
      <div
        className="rounded-xl px-6 py-8 text-center"
        style={{
          border: `1px solid ${tl.border}`,
          backgroundColor: tl.bg,
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: tl.faint }}>
          Timeline
        </p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: tl.faint }}>
          No events tracked yet. Deadlines and comment periods will appear here.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs underline underline-offset-2 transition-colors"
          style={{ color: tl.muted }}
        >
          Add an event
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: tl.faint }}>
          Timeline
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[10px] transition-colors"
            style={{ color: tl.faint }}
          >
            + Add event
          </button>
        )}
      </div>

      {/* Timeline entries */}
      {events.length > 0 && (
        <div className="relative">
          <div
            className="absolute left-2 top-3 bottom-3 w-px"
            style={{ backgroundColor: tl.line }}
          />

          <div className="space-y-4">
            {events.map((event) => {
              const past = isPast(event.eventDate)
              const style = EVENT_TYPE_STYLES[event.eventType] ?? EVENT_TYPE_STYLES.custom

              return (
                <div
                  key={event.id}
                  className="flex gap-4 items-start"
                  style={{ opacity: past ? 0.5 : 1 }}
                >
                  <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '16px' }}>
                    <span
                      className="h-2 w-2 rounded-full mt-1.5"
                      style={{ backgroundColor: getDotColor(event.eventType) }}
                    />
                  </div>

                  <div className="flex-1 min-w-0 pb-2">
                    <p className="text-xs font-medium leading-snug" style={{ color: tl.text }}>{event.title}</p>
                    {event.description && (
                      <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: tl.faint }}>
                        {event.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: tl.faint }}>{event.eventDate}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                        style={{ color: style.color, backgroundColor: style.bg }}
                      >
                        {event.eventType.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add event form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl px-4 py-4 space-y-3"
          style={{
            border: `1px solid ${tl.border}`,
            backgroundColor: tl.bg,
          }}
        >
          <input
            type="text"
            placeholder="Event title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
            style={{ borderColor: tl.border, color: tl.text }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
              style={{ borderColor: tl.border, color: tl.text }}
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
              style={{ borderColor: tl.border, color: tl.text }}
            >
              <option value="deadline">Deadline</option>
              <option value="meeting">Meeting</option>
              <option value="decision">Decision</option>
              <option value="comment_period">Comment Period</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <textarea
            placeholder="Description (optional)"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none resize-none"
            style={{ borderColor: tl.border, color: tl.text }}
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[10px] transition-colors px-3 py-1.5"
              style={{ color: tl.faint }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formTitle.trim() || !formDate}
              className="rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{
                color: 'var(--accent-gadfly)',
                backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-gadfly) 20%, transparent)',
              }}
            >
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
