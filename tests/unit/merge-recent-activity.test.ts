import { describe, it, expect } from 'vitest'
import {
  mergeRecentActivity,
  type InvestigationActivityRow,
  type GadflyActivityRow,
  type LeverActivityRow,
} from '@/lib/activity/merge-recent-activity'

describe('mergeRecentActivity', () => {
  it('returns empty array when all three sources are empty', () => {
    expect(mergeRecentActivity([], [], [])).toEqual([])
  })

  it('tags each source with its type and builds the correct href', () => {
    const investigations: InvestigationActivityRow[] = [
      { id: 'inv-1', concern: 'Zoning change', status: 'active', createdAt: new Date('2026-06-01') },
    ]
    const sessions: GadflyActivityRow[] = [
      { id: 'ses-1', title: 'Budget inquiry', status: 'active', createdAt: new Date('2026-06-02') },
    ]
    const actions: LeverActivityRow[] = [
      { id: 'act-1', title: 'FIPPA request', status: 'draft', createdAt: new Date('2026-06-03') },
    ]

    const result = mergeRecentActivity(investigations, sessions, actions)
    expect(result).toHaveLength(3)

    const investigationItem = result.find((i) => i.id === 'inv-1')
    expect(investigationItem?.type).toBe('investigation')
    expect(investigationItem?.title).toBe('Zoning change')
    expect(investigationItem?.href).toBe('/investigate/inv-1')

    const inquiryItem = result.find((i) => i.id === 'ses-1')
    expect(inquiryItem?.type).toBe('inquiry')
    expect(inquiryItem?.title).toBe('Budget inquiry')
    expect(inquiryItem?.href).toBe('/gadfly/ses-1')

    const actionItem = result.find((i) => i.id === 'act-1')
    expect(actionItem?.type).toBe('action')
    expect(actionItem?.title).toBe('FIPPA request')
    expect(actionItem?.href).toBe('/lever/act-1')
  })

  it('sorts merged items by createdAt descending across all three types', () => {
    const investigations: InvestigationActivityRow[] = [
      { id: 'inv-1', concern: 'Oldest', status: 'active', createdAt: new Date('2026-01-01') },
    ]
    const sessions: GadflyActivityRow[] = [
      { id: 'ses-1', title: 'Newest', status: 'active', createdAt: new Date('2026-06-01') },
    ]
    const actions: LeverActivityRow[] = [
      { id: 'act-1', title: 'Middle', status: 'draft', createdAt: new Date('2026-03-01') },
    ]

    const result = mergeRecentActivity(investigations, sessions, actions)
    expect(result.map((i) => i.id)).toEqual(['ses-1', 'act-1', 'inv-1'])
  })

  it('caps the merged list at the given limit', () => {
    const sessions: GadflyActivityRow[] = Array.from({ length: 10 }, (_, i) => ({
      id: `ses-${i}`,
      title: `Session ${i}`,
      status: 'active',
      createdAt: new Date(2026, 0, i + 1),
    }))

    const result = mergeRecentActivity([], sessions, [], 8)
    expect(result).toHaveLength(8)
    // Most recent (highest index date) should be first
    expect(result[0].id).toBe('ses-9')
  })

  it('defaults to a limit of 8 when none is given', () => {
    const actions: LeverActivityRow[] = Array.from({ length: 12 }, (_, i) => ({
      id: `act-${i}`,
      title: `Action ${i}`,
      status: 'draft',
      createdAt: new Date(2026, 0, i + 1),
    }))

    const result = mergeRecentActivity([], [], actions)
    expect(result).toHaveLength(8)
  })
})
