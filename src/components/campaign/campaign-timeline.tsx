'use client'

interface TimelineEvent {
  date: string
  event: string
  significance: string
  actor?: string
}

interface TimelineDeadline {
  date: string
  action: string
  critical: boolean
}

interface CampaignTimelineProps {
  events: TimelineEvent[]
  deadlines: TimelineDeadline[]
}

// Sort comparator — dates may be partial strings ("March 2024") so we try
// Date.parse first and fall back to string comparison.
function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.date)
    const tb = Date.parse(b.date)
    if (!isNaN(ta) && !isNaN(tb)) return ta - tb
    return a.date.localeCompare(b.date)
  })
}

export function CampaignTimeline({ events, deadlines }: CampaignTimelineProps) {
  const sortedEvents = sortByDate(events)
  const sortedDeadlines = sortByDate(deadlines)

  if (events.length === 0 && deadlines.length === 0) {
    return (
      <p className="text-sm" style={{ color: '#a8a29e' }}>
        No timeline data in this material.
      </p>
    )
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: '#faf9f7', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {/* Left: Events */}
        {sortedEvents.length > 0 && (
          <div>
            <p
              className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#a8a29e' }}
            >
              Key Events
            </p>
            <div className="relative pl-4 space-y-4">
              {/* Vertical rule */}
              <div
                className="absolute left-[3px] top-2 bottom-2 w-px"
                style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
              />
              {sortedEvents.map((ev, i) => (
                <div key={i} className="relative flex gap-3">
                  <div
                    className="absolute -left-4 mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: '#78716c' }}
                  />
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: '#a8a29e' }}>{ev.date}</p>
                    <p className="text-sm font-medium leading-snug" style={{ color: '#292524' }}>{ev.event}</p>
                    {ev.actor && (
                      <p className="text-xs" style={{ color: '#78716c' }}>{ev.actor}</p>
                    )}
                    {ev.significance && (
                      <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#78716c' }}>{ev.significance}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right: Deadlines */}
        {sortedDeadlines.length > 0 && (
          <div>
            <p
              className="mb-4 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#C85B5B' }}
            >
              Deadlines
            </p>
            <div className="space-y-3">
              {sortedDeadlines.map((dl, i) => (
                <div
                  key={i}
                  className="rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: dl.critical
                      ? 'rgba(200, 91, 91, 0.07)'
                      : 'rgba(0,0,0,0.04)',
                    border: dl.critical
                      ? '1px solid rgba(200, 91, 91, 0.2)'
                      : '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p
                        className="text-[10px] font-medium"
                        style={{ color: dl.critical ? '#C85B5B' : '#a8a29e' }}
                      >
                        {dl.date}
                      </p>
                      <p className="text-sm leading-snug mt-0.5" style={{ color: '#292524' }}>
                        {dl.action}
                      </p>
                    </div>
                    {dl.critical && (
                      <span
                        className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                        style={{
                          backgroundColor: 'rgba(200,91,91,0.15)',
                          color: '#C85B5B',
                        }}
                      >
                        Critical
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
