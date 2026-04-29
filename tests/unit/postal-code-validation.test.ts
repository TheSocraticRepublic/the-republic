import { describe, it, expect } from 'vitest'
import {
  normalizePostalCode,
  isValidCanadianPostalCode,
} from '@/lib/parliament/represent'

describe('Canadian postal code validation', () => {
  describe('normalizePostalCode', () => {
    it('uppercases and strips spaces', () => {
      expect(normalizePostalCode('v8b 0a1')).toBe('V8B0A1')
    })

    it('handles multiple spaces', () => {
      expect(normalizePostalCode('k1a  0a6')).toBe('K1A0A6')
    })

    it('passes through already-normalized codes', () => {
      expect(normalizePostalCode('V8B0A1')).toBe('V8B0A1')
    })
  })

  describe('isValidCanadianPostalCode', () => {
    const valid = [
      'V8B0A1',
      'K1A 0A6',
      'm5v 2t6',
      'H2X 1Y4',
      'T5J 0R7',
      'R3C 0V8',
    ]

    for (const code of valid) {
      it(`accepts "${code}"`, () => {
        expect(isValidCanadianPostalCode(code)).toBe(true)
      })
    }

    const invalid = [
      '',
      '12345',
      'ABCDEF',
      'V8B',
      'V8B0A',
      'V8B0A1X',
      '123 456',
    ]

    for (const code of invalid) {
      it(`rejects "${code}"`, () => {
        expect(isValidCanadianPostalCode(code)).toBe(false)
      })
    }
  })
})
