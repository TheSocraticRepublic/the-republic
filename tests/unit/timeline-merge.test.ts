import { describe, it, expect } from 'vitest'
import {
  mergeTimelineEvents,
  type IssueTrackingRow,
  type RegulatoryProcessRow,
} from '@/lib/timeline/merge'

describe('mergeTimelineEvents', () => {
  it('returns empty array when both sources are empty', () => {
    expect(mergeTimelineEvents([], [])).toEqual([])
  })

  it('passes through issue tracking events with source tag', () => {
    const issues: IssueTrackingRow[] = [
      {
        id: 'it-1',
        eventType: 'deadline',
        title: 'Comment deadline',
        description: null,
        eventDate: '2026-05-01',
        status: 'upcoming',
      },
    ]
    const result = mergeTimelineEvents(issues, [])
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('issue_tracking')
    expect(result[0].id).toBe('it-1')
  })

  it('generates two events from a regulatory process with both dates', () => {
    const procs: RegulatoryProcessRow[] = [
      {
        id: 'rp-1',
        projectName: 'Pipeline Review',
        commentPeriodOpens: '2026-04-15',
        commentPeriodCloses: '2026-05-15',
        status: 'active',
      },
    ]
    const result = mergeTimelineEvents([], procs)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('rp-1-opens')
    expect(result[0].title).toContain('Comment period opens')
    expect(result[0].title).toContain('Pipeline Review')
    expect(result[1].id).toBe('rp-1-closes')
    expect(result[1].title).toContain('Comment period closes')
  })

  it('generates one event when only commentPeriodCloses is set', () => {
    const procs: RegulatoryProcessRow[] = [
      {
        id: 'rp-2',
        projectName: 'Mine Expansion',
        commentPeriodOpens: null,
        commentPeriodCloses: '2026-06-01',
        status: null,
      },
    ]
    const result = mergeTimelineEvents([], procs)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('rp-2-closes')
    expect(result[0].status).toBe('upcoming')
  })

  it('skips regulatory processes with no dates', () => {
    const procs: RegulatoryProcessRow[] = [
      {
        id: 'rp-3',
        projectName: 'No Dates',
        commentPeriodOpens: null,
        commentPeriodCloses: null,
        status: null,
      },
    ]
    expect(mergeTimelineEvents([], procs)).toEqual([])
  })

  it('sorts merged events by date ascending', () => {
    const issues: IssueTrackingRow[] = [
      {
        id: 'it-1',
        eventType: 'meeting',
        title: 'Council meeting',
        description: null,
        eventDate: '2026-05-10',
        status: 'upcoming',
      },
    ]
    const procs: RegulatoryProcessRow[] = [
      {
        id: 'rp-1',
        projectName: 'Review',
        commentPeriodOpens: '2026-04-01',
        commentPeriodCloses: '2026-06-01',
        status: 'active',
      },
    ]
    const result = mergeTimelineEvents(issues, procs)
    expect(result).toHaveLength(3)
    expect(result[0].eventDate).toBe('2026-04-01')
    expect(result[1].eventDate).toBe('2026-05-10')
    expect(result[2].eventDate).toBe('2026-06-01')
  })

  it('all regulatory events have source "regulatory_process"', () => {
    const procs: RegulatoryProcessRow[] = [
      {
        id: 'rp-1',
        projectName: 'Test',
        commentPeriodOpens: '2026-01-01',
        commentPeriodCloses: '2026-02-01',
        status: 'active',
      },
    ]
    const result = mergeTimelineEvents([], procs)
    for (const event of result) {
      expect(event.source).toBe('regulatory_process')
      expect(event.eventType).toBe('comment_period')
    }
  })
})
