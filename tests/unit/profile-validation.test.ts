import { describe, it, expect } from 'vitest'
import {
  validateDisplayName,
  validateBio,
  stripHtmlTags,
  canChangeDisplayName,
} from '@/lib/profile/validation'

describe('validateDisplayName', () => {
  it('accepts valid lowercase names', () => {
    expect(validateDisplayName('citizen_42').valid).toBe(true)
    expect(validateDisplayName('jane-doe').valid).toBe(true)
    expect(validateDisplayName('republic2026').valid).toBe(true)
    expect(validateDisplayName('abc').valid).toBe(true)
  })

  it('rejects uppercase letters (names must be pre-lowercased)', () => {
    // Callers must lowercase before calling validateDisplayName
    expect(validateDisplayName('Republic2026').valid).toBe(false)
    expect(validateDisplayName('Jane').valid).toBe(false)
    expect(validateDisplayName('ADMIN').valid).toBe(false)
  })

  it('rejects names with spaces', () => {
    const result = validateDisplayName('my name')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects names with special characters', () => {
    expect(validateDisplayName('user@home').valid).toBe(false)
    expect(validateDisplayName('<script>').valid).toBe(false)
    expect(validateDisplayName('hello!').valid).toBe(false)
  })

  it('rejects names under 3 characters', () => {
    expect(validateDisplayName('ab').valid).toBe(false)
    expect(validateDisplayName('a').valid).toBe(false)
  })

  it('rejects names over 50 characters', () => {
    const longName = 'a'.repeat(51)
    expect(validateDisplayName(longName).valid).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateDisplayName('').valid).toBe(false)
  })

  it('accepts exactly 3 characters', () => {
    expect(validateDisplayName('abc').valid).toBe(true)
  })

  it('accepts exactly 50 characters', () => {
    const maxName = 'a'.repeat(50)
    expect(validateDisplayName(maxName).valid).toBe(true)
  })

  describe('reserved names', () => {
    it('rejects "admin"', () => {
      const result = validateDisplayName('admin')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('This name is reserved')
    })

    it('rejects "moderator"', () => {
      expect(validateDisplayName('moderator').valid).toBe(false)
    })

    it('rejects "system"', () => {
      expect(validateDisplayName('system').valid).toBe(false)
    })

    it('rejects "support"', () => {
      expect(validateDisplayName('support').valid).toBe(false)
    })

    it('rejects "help"', () => {
      expect(validateDisplayName('help').valid).toBe(false)
    })

    it('rejects "republic"', () => {
      expect(validateDisplayName('republic').valid).toBe(false)
    })

    it('rejects "api"', () => {
      expect(validateDisplayName('api').valid).toBe(false)
    })

    it('rejects "profile"', () => {
      expect(validateDisplayName('profile').valid).toBe(false)
    })

    it('rejects "login"', () => {
      expect(validateDisplayName('login').valid).toBe(false)
    })

    it('rejects "null"', () => {
      expect(validateDisplayName('null').valid).toBe(false)
    })

    it('rejects "root"', () => {
      expect(validateDisplayName('root').valid).toBe(false)
    })

    it('accepts a name that contains a reserved word as a substring', () => {
      // "admirable" is not "admin" — substring matches should not be blocked
      expect(validateDisplayName('admirable').valid).toBe(true)
      expect(validateDisplayName('helpful').valid).toBe(true)
    })
  })
})

describe('validateBio', () => {
  it('accepts bio of exactly 500 characters', () => {
    const bio = 'x'.repeat(500)
    expect(validateBio(bio).valid).toBe(true)
  })

  it('rejects bio of 501 characters', () => {
    const bio = 'x'.repeat(501)
    const result = validateBio(bio)
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('accepts empty bio', () => {
    expect(validateBio('').valid).toBe(true)
  })
})

describe('stripHtmlTags', () => {
  it('strips bold tags', () => {
    expect(stripHtmlTags('<b>bold</b>')).toBe('bold')
  })

  it('strips script tags and leaves inner text', () => {
    expect(stripHtmlTags('<script>alert("xss")</script>')).toBe('alert("xss")')
  })

  it('strips multiple tags', () => {
    expect(stripHtmlTags('<p>Hello <strong>world</strong></p>')).toBe('Hello world')
  })

  it('leaves plain text unchanged', () => {
    expect(stripHtmlTags('plain text')).toBe('plain text')
  })

  it('handles self-closing tags', () => {
    expect(stripHtmlTags('line1<br/>line2')).toBe('line1line2')
  })
})

describe('canChangeDisplayName', () => {
  it('returns true when lastChangedAt is null (never changed)', () => {
    expect(canChangeDisplayName(null)).toBe(true)
  })

  it('returns false when lastChangedAt is 15 days ago', () => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    expect(canChangeDisplayName(fifteenDaysAgo)).toBe(false)
  })

  it('returns true when lastChangedAt is 31 days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(canChangeDisplayName(thirtyOneDaysAgo)).toBe(true)
  })

  it('returns false when lastChangedAt is today', () => {
    const now = new Date()
    expect(canChangeDisplayName(now)).toBe(false)
  })

  it('returns false at exactly 29 days ago', () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    expect(canChangeDisplayName(twentyNineDaysAgo)).toBe(false)
  })

  it('returns true at exactly 30 days ago (boundary)', () => {
    // 30 days ago: should be exactly at boundary — >= 30 days = allowed
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    expect(canChangeDisplayName(thirtyDaysAgo)).toBe(true)
  })
})
