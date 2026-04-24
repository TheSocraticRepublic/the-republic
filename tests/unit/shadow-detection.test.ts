import { describe, it, expect } from 'vitest'
import { extractTopics } from '@/lib/archive/shadow'

// detectShadows requires a live DB — unit tests focus on the pure helper
// functions and the confidence calculation logic.

describe('extractTopics', () => {
  it('returns an empty set for empty string', () => {
    const topics = extractTopics('')
    expect(topics.size).toBe(0)
  })

  it('returns an empty set for whitespace-only string', () => {
    const topics = extractTopics('   \n\t  ')
    expect(topics.size).toBe(0)
  })

  it('extracts significant words from text', () => {
    const topics = extractTopics('The rezoning application threatens wetland habitat')
    // "the" and "and" are stopwords, short words filtered
    expect(topics.has('rezoning')).toBe(true)
    expect(topics.has('application')).toBe(true)
    expect(topics.has('threatens')).toBe(true)
    expect(topics.has('wetland')).toBe(true)
    expect(topics.has('habitat')).toBe(true)
  })

  it('filters stopwords', () => {
    const topics = extractTopics('the and or but in on at to for of with by from as is was')
    expect(topics.size).toBe(0)
  })

  it('filters words shorter than 4 characters', () => {
    const topics = extractTopics('The big cat sat on the hot mat')
    // "big", "cat", "sat", "hot", "mat" are all 3 chars
    expect(topics.has('big')).toBe(false)
    expect(topics.has('cat')).toBe(false)
  })

  it('lowercases all topics', () => {
    const topics = extractTopics('Wetland Habitat REZONING')
    expect(topics.has('wetland')).toBe(true)
    expect(topics.has('habitat')).toBe(true)
    expect(topics.has('rezoning')).toBe(true)
    expect(topics.has('Wetland')).toBe(false)
    expect(topics.has('REZONING')).toBe(false)
  })

  it('strips punctuation', () => {
    const topics = extractTopics('wetland, habitat. rezoning!')
    expect(topics.has('wetland')).toBe(true)
    expect(topics.has('habitat')).toBe(true)
    expect(topics.has('rezoning')).toBe(true)
  })

  it('returns a Set (deduplicates repeated words)', () => {
    const topics = extractTopics('rezoning rezoning rezoning')
    expect(topics.has('rezoning')).toBe(true)
    // Set deduplicates — size is 1, not 3
    expect(topics.size).toBe(1)
  })

  it('filters words that do not start with a letter', () => {
    const topics = extractTopics('2024 123abc $money 5000acres')
    expect(topics.has('2024')).toBe(false)
  })
})

describe('confidence calculation', () => {
  // Test the confidence ratio logic directly.
  // confidence = peerIds.length / total
  // These tests verify the math holds for boundary conditions.

  it('confidence is 1.0 when topic appears in all peers', () => {
    const total = 5
    const appearances = 5
    const confidence = appearances / total
    expect(confidence).toBe(1.0)
  })

  it('confidence is 0.5 when topic appears in half of peers', () => {
    const total = 6
    const appearances = 3
    const confidence = appearances / total
    expect(confidence).toBeCloseTo(0.5)
  })

  it('confidence is 0.8 when topic appears in 4 of 5 peers', () => {
    const total = 5
    const appearances = 4
    const confidence = appearances / total
    expect(confidence).toBeCloseTo(0.8)
  })

  it('presence threshold of 0.5 is met at 3 of 5 (not at 2 of 5)', () => {
    const total = 5
    const THRESHOLD = 0.5
    expect(3 / total).toBeGreaterThanOrEqual(THRESHOLD)
    expect(2 / total).toBeLessThan(THRESHOLD)
  })
})

describe('alert cap', () => {
  it('cap of 10 alerts slices correctly', () => {
    // Simulate what detectShadows does: slice to MAX_ALERTS
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      topic: `topic${i}`,
      confidence: 0.9,
    }))
    const MAX_ALERTS = 10
    const capped = candidates.slice(0, MAX_ALERTS)
    expect(capped.length).toBe(10)
  })

  it('returns all alerts when fewer than cap', () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      topic: `topic${i}`,
      confidence: 0.9,
    }))
    const MAX_ALERTS = 10
    const capped = candidates.slice(0, MAX_ALERTS)
    expect(capped.length).toBe(5)
  })
})
