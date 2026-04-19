// IssueTimeline — placeholder for Phase 2C when IAAC integration lands.
// Will be populated with regulatory deadlines and comment periods.

interface TimelineEvent {
  id: string
  eventType: string
  title: string
  eventDate: string
  status: string
}

interface IssueTimelineProps {
  investigationId: string
  events: TimelineEvent[]
}

export function IssueTimeline({ investigationId: _, events }: IssueTimelineProps) {
  if (events.length === 0) {
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
        <p className="text-sm text-neutral-600 leading-relaxed">
          No events tracked yet. Deadlines and comment periods will appear here as they're detected.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
        Timeline
      </p>
      <div className="relative">
        {/* Connecting line */}
        <div
          className="absolute left-2 top-3 bottom-3 w-px"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
        />

        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex gap-4 items-start">
              {/* Dot */}
              <div className="flex-shrink-0 flex items-center justify-center" style={{ width: '16px' }}>
                <span
                  className="h-2 w-2 rounded-full mt-1.5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-2">
                <p className="text-xs font-medium text-neutral-300 leading-snug">{event.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-neutral-600">{event.eventDate}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                    style={{
                      color: '#a3a3a3',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {event.eventType}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
