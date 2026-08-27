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

// Island tokens consumed via CSS custom properties (globals.css).

interface IssueTimelineProps {
  investigationId: string
  events: TimelineEvent[]
  onEventAdded?: (event: TimelineEvent) => void
  darkMode?: boolean
}

const EVENT_TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  deadline: { color: 'var(--status-danger)', bg: 'color-mix(in srgb, var(--status-danger) 10%, transparent)' },
  comment_period: { color: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 10%, transparent)' },
  meeting: { color: 'var(--island-role-official)', bg: 'color-mix(in srgb, var(--island-role-official) 10%, transparent)' },
  decision: { color: 'var(--status-success)', bg: 'color-mix(in srgb, var(--status-success) 10%, transparent)' },
  custom: { color: 'var(--island-role-company)', bg: 'color-mix(in srgb, var(--island-role-company) 8%, transparent)' },
}

function getDotColor(eventType: string): string {
  return EVENT_TYPE_STYLES[eventType]?.color ?? EVENT_TYPE_STYLES.custom.color
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function IssueTimeline({ investigationId, events, onEventAdded, darkMode = false }: IssueTimelineProps) {
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
          border: `1px solid var(--color-island-border)`,
          backgroundColor: 'var(--color-island-bg)',
        }}
      >
        <p className="text-3xs font-semibold uppercase mb-2" style={{ color: 'var(--color-island-faint)' }}>
          Timeline
        </p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-island-faint)' }}>
          No events tracked yet. Deadlines and comment periods will appear here.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="text-xs underline underline-offset-2 transition-colors"
          style={{ color: 'var(--color-island-muted)' }}
        >
          Add an event
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-1${darkMode ? ' dark-island' : ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-3xs font-semibold uppercase" style={{ color: 'var(--color-island-faint)' }}>
          Timeline
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-2xs font-medium transition-colors"
            style={{ color: 'var(--color-island-faint)' }}
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
            style={{ backgroundColor: 'var(--color-island-veil)' }}
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
                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--color-island-text)' }}>{event.title}</p>
                    {event.description && (
                      <p className="mt-0.5 text-2xs font-medium leading-relaxed" style={{ color: 'var(--color-island-faint)' }}>
                        {event.description}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-2xs font-medium" style={{ color: 'var(--color-island-faint)' }}>{event.eventDate}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-3xs font-semibold uppercase"
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
            border: `1px solid var(--color-island-border)`,
            backgroundColor: 'var(--color-island-bg)',
          }}
        >
          <input
            type="text"
            placeholder="Event title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
            style={{ borderColor: 'var(--color-island-border)', color: 'var(--color-island-text)' }}
            aria-label="Event title"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--color-island-border)', color: 'var(--color-island-text)' }}
              aria-label="Event date"
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex-1 rounded-lg border px-3 py-2 text-xs bg-transparent focus:outline-none"
              style={{ borderColor: 'var(--color-island-border)', color: 'var(--color-island-text)' }}
              aria-label="Event type"
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
            style={{ borderColor: 'var(--color-island-border)', color: 'var(--color-island-text)' }}
            aria-label="Event description"
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-2xs font-medium transition-colors px-3 py-1.5"
              style={{ color: 'var(--color-island-faint)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formTitle.trim() || !formDate}
              className="rounded-lg px-3 py-1.5 text-3xs font-semibold uppercase transition-colors disabled:opacity-40"
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
