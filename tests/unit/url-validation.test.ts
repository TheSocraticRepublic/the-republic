import { describe, it, expect } from 'vitest'
import { isValidFederationUrl } from '@/lib/activitypub/url-validation'
import { isValidDocumentUrl } from '@/lib/archive/url-validation'

const SHARED_REJECTS = [
  ['loopback 127.0.0.1', 'https://127.0.0.1/'],
  ['loopback 127.0.0.2', 'https://127.0.0.2/'],
  ['IPv6 loopback', 'https://[::1]/'],
  ['IPv4-mapped loopback', 'https://[::ffff:127.0.0.1]/'],
  ['IPv4-mapped private 10.x', 'https://[::ffff:10.0.0.1]/'],
  ['IPv4-mapped private 192.168.x', 'https://[::ffff:192.168.1.1]/'],
  ['ULA fd00::', 'https://[fd00::1]/'],
  ['0.0.0.0', 'https://0.0.0.0/'],
  ['0.0.0.2 (0/8 range)', 'https://0.0.0.2/'],
  ['private 10.x', 'https://10.0.0.1/'],
  ['IMDS', 'https://169.254.169.254/'],
] as const

const SHARED_ACCEPTS = [
  ['example.com', 'https://example.com/'],
  ['opencave.ca', 'https://opencave.ca/'],
] as const

describe('isValidFederationUrl', () => {
  for (const [label, url] of SHARED_REJECTS) {
    it(`rejects ${label}`, () => {
      expect(isValidFederationUrl(url)).toBe(false)
    })
  }

  for (const [label, url] of SHARED_ACCEPTS) {
    it(`accepts ${label}`, () => {
      expect(isValidFederationUrl(url)).toBe(true)
    })
  }

  it('rejects http:// (HTTPS only)', () => {
    expect(isValidFederationUrl('http://example.com/')).toBe(false)
  })
})

describe('isValidDocumentUrl', () => {
  for (const [label, url] of SHARED_REJECTS) {
    it(`rejects ${label}`, () => {
      expect(isValidDocumentUrl(url)).toBe(false)
    })
  }

  // Also test http:// variants for archive
  it('rejects http://127.0.0.1/', () => {
    expect(isValidDocumentUrl('http://127.0.0.1/')).toBe(false)
  })

  for (const [label, url] of SHARED_ACCEPTS) {
    it(`accepts ${label}`, () => {
      expect(isValidDocumentUrl(url)).toBe(true)
    })
  }

  it('accepts http:// URLs', () => {
    expect(isValidDocumentUrl('http://example.com/')).toBe(true)
  })

  // Non-standard IPv4 encoding (SEC-F4)
  it('rejects decimal encoding (2130706433)', () => {
    expect(isValidDocumentUrl('http://2130706433/')).toBe(false)
  })

  it('rejects hex encoding (0x7f000001)', () => {
    expect(isValidDocumentUrl('http://0x7f000001/')).toBe(false)
  })

  it('rejects octal encoding (0177.0.0.1)', () => {
    expect(isValidDocumentUrl('http://0177.0.0.1/')).toBe(false)
  })

  it('rejects shorthand (127.1)', () => {
    expect(isValidDocumentUrl('http://127.1/')).toBe(false)
  })

  it('accepts legitimate public IP', () => {
    expect(isValidDocumentUrl('http://142.34.208.209/')).toBe(true)
  })

  it('accepts hostname with digits', () => {
    expect(isValidDocumentUrl('http://web2.gov.bc.ca/')).toBe(true)
  })
})
