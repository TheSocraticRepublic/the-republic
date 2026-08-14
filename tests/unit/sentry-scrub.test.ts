import { describe, it, expect } from 'vitest'
import { redactUrl, scrubBreadcrumb, scrubSpans, scrubEventPII } from '@/lib/sentry-scrub'

describe('redactUrl', () => {
  it('strips the postal code from a Represent API URL', () => {
    const url = 'https://represent.opennorth.ca/postcodes/V6B1A1/?format=json'
    expect(redactUrl(url)).toBe('https://represent.opennorth.ca/postcodes/[redacted]/')
  })

  it('strips case-insensitively', () => {
    expect(redactUrl('https://example.com/Postcodes/K1A0A6/')).toBe(
      'https://example.com/Postcodes/[redacted]/'
    )
  })

  it('leaves non-postcode URLs unchanged (except query stripping)', () => {
    expect(redactUrl('https://opencave.ca/api/investigate/abc?foo=bar')).toBe(
      'https://opencave.ca/api/investigate/abc'
    )
  })

  it('strips query strings', () => {
    expect(redactUrl('https://example.com/path?secret=123')).toBe(
      'https://example.com/path'
    )
  })

  it('strips hash fragments', () => {
    expect(redactUrl('https://example.com/path#section')).toBe(
      'https://example.com/path'
    )
  })

  it('handles URLs with no path segments after postcodes/', () => {
    expect(redactUrl('https://example.com/postcodes/')).toBe(
      'https://example.com/postcodes/'
    )
  })
})

describe('scrubBreadcrumb', () => {
  it('redacts a fetch breadcrumb URL containing a postal code', () => {
    const bc = {
      category: 'fetch' as const,
      data: { url: 'https://represent.opennorth.ca/postcodes/V6B1A1/?format=json' },
    }
    scrubBreadcrumb(bc)
    expect(bc.data.url).toBe('https://represent.opennorth.ca/postcodes/[redacted]/')
    expect(bc.data.url).not.toContain('V6B1A1')
  })

  it('redacts http breadcrumbs (server-side fetch)', () => {
    const bc = {
      category: 'http' as const,
      data: { url: 'https://represent.opennorth.ca/postcodes/K1A0B1/?format=json' },
    }
    scrubBreadcrumb(bc)
    expect(bc.data.url).not.toContain('K1A0B1')
  })

  it('redacts navigation breadcrumbs', () => {
    const bc = {
      category: 'navigation' as const,
      data: { from: '/votes?postalCode=V6B1A1', to: '/votes/mp/abc' },
    }
    scrubBreadcrumb(bc)
    expect(bc.data.from).toBe('/votes')
    expect(bc.data.to).toBe('/votes/mp/abc')
  })

  it('does not touch non-network breadcrumbs', () => {
    const bc = { category: 'console' as const, data: { url: 'keep-this' } }
    scrubBreadcrumb(bc)
    expect(bc.data.url).toBe('keep-this')
  })
})

describe('scrubSpans', () => {
  it('redacts span description and data containing postal codes', () => {
    const spans = [
      {
        description: 'GET https://represent.opennorth.ca/postcodes/V6B1A1/?format=json',
        data: {
          'http.url': 'https://represent.opennorth.ca/postcodes/V6B1A1/?format=json',
          'http.method': 'GET',
        },
      },
    ]
    scrubSpans(spans)
    expect(spans[0].description).not.toContain('V6B1A1')
    expect(spans[0].data['http.url']).not.toContain('V6B1A1')
    expect(spans[0].data['http.method']).toBe('GET')
  })
})

describe('scrubEventPII', () => {
  it('strips IP-bearing headers', () => {
    const event = {
      request: {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'X-Real-Ip': '5.6.7.8',
          'x-nf-client-connection-ip': '9.10.11.12',
          'content-type': 'application/json',
        },
      },
    }
    scrubEventPII(event)
    expect(event.request.headers).not.toHaveProperty('x-forwarded-for')
    expect(event.request.headers).not.toHaveProperty('X-Real-Ip')
    expect(event.request.headers).not.toHaveProperty('x-nf-client-connection-ip')
    expect(event.request.headers).toHaveProperty('content-type')
  })
})
