export interface TimelineEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  eventDate: string
  status: string
  source: 'issue_tracking' | 'regulatory_process'
}

export interface IssueTrackingRow {
  id: string
  eventType: string
  title: string
  description: string | null
  eventDate: string
  status: string
}

export interface RegulatoryProcessRow {
  id: string
  projectName: string
  commentPeriodOpens: string | null
  commentPeriodCloses: string | null
  status: string | null
}

export function mergeTimelineEvents(
  issueEvents: IssueTrackingRow[],
  regProcesses: RegulatoryProcessRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const e of issueEvents) {
    events.push({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      eventDate: e.eventDate,
      status: e.status,
      source: 'issue_tracking',
    })
  }

  for (const rp of regProcesses) {
    if (rp.commentPeriodOpens) {
      events.push({
        id: `${rp.id}-opens`,
        eventType: 'comment_period',
        title: `Comment period opens: ${rp.projectName}`,
        description: null,
        eventDate: rp.commentPeriodOpens,
        status: rp.status || 'upcoming',
        source: 'regulatory_process',
      })
    }
    if (rp.commentPeriodCloses) {
      events.push({
        id: `${rp.id}-closes`,
        eventType: 'comment_period',
        title: `Comment period closes: ${rp.projectName}`,
        description: null,
        eventDate: rp.commentPeriodCloses,
        status: rp.status || 'upcoming',
        source: 'regulatory_process',
      })
    }
  }

  events.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  return events
}
