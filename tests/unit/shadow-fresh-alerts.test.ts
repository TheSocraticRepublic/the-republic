import { describe, it, expect } from 'vitest'
import { pickFreshAlerts } from '@/app/api/investigate/route'
import type { ShadowAlert } from '@/lib/archive/shadow'

const makeAlert = (topic: string, confidence = 0.8): ShadowAlert => ({
  alertType: 'missing_topic',
  missingTopic: topic,
  referenceInvestigationIds: [],
  confidence,
})

describe('pickFreshAlerts', () => {
  it('returns all detected alerts when no existing topics', () => {
    const detected = [makeAlert('pipeline'), makeAlert('wetland')]
    const result = pickFreshAlerts([], detected)
    expect(result).toHaveLength(2)
  })

  it('filters out alerts whose topics are already stored', () => {
    const detected = [makeAlert('pipeline'), makeAlert('wetland'), makeAlert('salmon')]
    const result = pickFreshAlerts(['pipeline', 'salmon'], detected)
    expect(result).toHaveLength(1)
    expect(result[0].missingTopic).toBe('wetland')
  })

  it('returns empty array when all detected topics are already stored', () => {
    const detected = [makeAlert('pipeline'), makeAlert('wetland')]
    const result = pickFreshAlerts(['pipeline', 'wetland', 'salmon'], detected)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when both inputs are empty', () => {
    const result = pickFreshAlerts([], [])
    expect(result).toHaveLength(0)
  })

  it('is case-sensitive — does not conflate "Pipeline" with "pipeline"', () => {
    // missingTopic from detectShadows is always lowercased by extractTopics
    const detected = [makeAlert('pipeline')]
    const result = pickFreshAlerts(['Pipeline'], detected)
    // 'pipeline' !== 'Pipeline', so it should pass through
    expect(result).toHaveLength(1)
  })

  it('preserves the original alert objects (not copies)', () => {
    const alert = makeAlert('wetland', 0.9)
    const result = pickFreshAlerts(['pipeline'], [alert])
    expect(result[0]).toBe(alert) // same reference
  })

  it('deduplicates correctly with multiple existing topics', () => {
    const detected = [
      makeAlert('pipeline', 0.9),
      makeAlert('wetland', 0.8),
      makeAlert('salmon', 0.7),
      makeAlert('mining', 0.6),
    ]
    const existing = ['pipeline', 'salmon']
    const result = pickFreshAlerts(existing, detected)
    expect(result.map((a) => a.missingTopic)).toEqual(['wetland', 'mining'])
  })
})
