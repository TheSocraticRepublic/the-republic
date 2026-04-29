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

interface IssueTimelineProps {
  investigationId: string
  events: TimelineEvent[]
  onEventAdded?: (event: TimelineEvent) => void
}

const EVENT_TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  deadline: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  comment_period: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  meeting: { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  decision: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  custom: { color: '#a3a3a3', bg: 'rgba(255,255,255,0.05)' },
}

function getDotColor(eventType: string): string {
  return EVENT_TYPE_STYLES[eventType]?.color ?? EVENT_TYPE_STYLES.custom.color
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function IssueTimeline({ investigationId, events, onEventAdded }: IssueTimelineProps) {
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
        className="rounded-xl border px-6 py-8 text-center"
        style={{
          borderColor: 'rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(255,255,255,0.015)',
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600 mb-2">
          Timeline
        </p>
        <p className="text-sm text-neutral-600 leading-relaxed mb-4">
          No events tracked yet. Deadlines and comment periods will appear here.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
        >
          Add an event
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Timeline
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
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
            style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
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
                    <p className="text-xs font-medium text-neutral-300 leading-snug">{event.title}</p>
                    {event.description && (
                      <p className="mt-0.5 text-[11px] text-neutral-600 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-neutral-600">{event.eventDate}</span>
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
          className="mt-4 rounded-xl border px-4 py-4 space-y-3"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.02)',
          }}
        >
          <input
            type="text"
            placeholder="Event title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent text-neutral-200 focus:outline-none focus:border-neutral-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)', colorScheme: 'dark' }}
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent text-neutral-200 focus:outline-none focus:border-neutral-500"
              style={{ borderColor: 'rgba(255,255,255,0.1)' }}
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
            className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formTitle.trim() || !formDate}
              className="rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-40"
              style={{
                color: '#C8A84B',
                backgroundColor: 'rgba(200,168,75,0.10)',
                border: '1px solid rgba(200,168,75,0.20)',
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
