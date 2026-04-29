import { describe, it, expect } from 'vitest'
import { parliamentSyncLog } from '@/lib/db/schema'

describe('Parliament sync log schema', () => {
  it('table is defined', () => {
    expect(parliamentSyncLog).toBeDefined()
  })

  it('has all required columns', () => {
    const cols = [
      'id',
      'syncType',
      'session',
      'recordsFetched',
      'recordsUpserted',
      'errors',
      'durationMs',
      'startedAt',
      'completedAt',
      'createdAt',
    ]
    for (const col of cols) {
      expect(parliamentSyncLog).toHaveProperty(col)
    }
  })
})
