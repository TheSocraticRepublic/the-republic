import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * CRITICAL-1 (OBS-1 review): the client Sentry SDK captures URLs in two
 * places `beforeSend`'s `event.request.url` scrub never reaches —
 * fetch/xhr/navigation breadcrumbs (`breadcrumb.data`) and `http.client`
 * transaction spans (`span.description` / `span.data`). This test mocks
 * '@sentry/nextjs' to capture the config object passed to `Sentry.init`,
 * then exercises `beforeBreadcrumb` and `beforeSendTransaction` directly —
 * mirroring the vi.mock + dynamic-import pattern already used in
 * run-briefing.test.ts for testing side-effecting module init.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedConfig: any = null

vi.mock('@sentry/nextjs', () => ({
  init: (config: unknown) => {
    capturedConfig = config
  },
  captureRouterTransitionStart: vi.fn(),
}))

async function loadInit() {
  capturedConfig = null
  vi.resetModules()
  await import('@/instrumentation-client')
  return capturedConfig
}

describe('instrumentation-client — beforeBreadcrumb URL scrub', () => {
  beforeEach(() => {
    capturedConfig = null
  })

  it('strips the query string from fetch breadcrumb URLs', async () => {
    const config = await loadInit()
    const result = config.beforeBreadcrumb({
      category: 'fetch',
      type: 'http',
      data: { url: '/api/parliament/lookup?postalCode=V8B0A1', method: 'POST' },
    })
    expect(result.data.url).toBe('/api/parliament/lookup')
  })

  it('strips the query string from xhr breadcrumb URLs', async () => {
    const config = await loadInit()
    const result = config.beforeBreadcrumb({
      category: 'xhr',
      type: 'http',
      data: { url: 'https://opencave.ca/api/parliament/lookup?postalCode=V8B0A1' },
    })
    expect(result.data.url).toBe('https://opencave.ca/api/parliament/lookup')
  })

  it('strips the query string from navigation breadcrumb to/from', async () => {
    const config = await loadInit()
    const result = config.beforeBreadcrumb({
      category: 'navigation',
      data: { from: '/votes?postalCode=V8B0A1', to: '/votes/mp/123?ref=lookup' },
    })
    expect(result.data.from).toBe('/votes')
    expect(result.data.to).toBe('/votes/mp/123')
  })

  it('leaves non-URL breadcrumb categories untouched', async () => {
    const config = await loadInit()
    const breadcrumb = { category: 'ui.click', data: { target: 'button#submit' } }
    const result = config.beforeBreadcrumb(breadcrumb)
    expect(result.data.target).toBe('button#submit')
  })
})

describe('instrumentation-client — beforeSendTransaction span scrub', () => {
  beforeEach(() => {
    capturedConfig = null
  })

  it('strips the query string from span.description', async () => {
    const config = await loadInit()
    const event = config.beforeSendTransaction({
      spans: [
        {
          description: 'GET /api/parliament/lookup?postalCode=V8B0A1',
          data: {},
        },
      ],
    })
    expect(event.spans[0].description).toBe('GET /api/parliament/lookup')
  })

  it('strips the query string from every string field in span.data regardless of attribute name', async () => {
    const config = await loadInit()
    const event = config.beforeSendTransaction({
      spans: [
        {
          description: 'GET /api/parliament/lookup',
          data: {
            url: '/api/parliament/lookup?postalCode=V8B0A1',
            'http.url': 'https://opencave.ca/api/parliament/lookup?postalCode=V8B0A1',
            'url.full': 'https://opencave.ca/api/parliament/lookup?postalCode=V8B0A1',
            'http.method': 'POST',
          },
        },
      ],
    })
    const data = event.spans[0].data
    expect(data.url).toBe('/api/parliament/lookup')
    expect(data['http.url']).toBe('https://opencave.ca/api/parliament/lookup')
    expect(data['url.full']).toBe('https://opencave.ca/api/parliament/lookup')
    // Non-URL string attributes are untouched (no '?' to strip).
    expect(data['http.method']).toBe('POST')
  })

  it('handles multiple spans and spans with no data', async () => {
    const config = await loadInit()
    const event = config.beforeSendTransaction({
      spans: [
        { description: 'GET /a?x=1', data: { url: '/a?x=1' } },
        { description: 'GET /b', data: undefined },
      ],
    })
    expect(event.spans[0].description).toBe('GET /a')
    expect(event.spans[0].data.url).toBe('/a')
    expect(event.spans[1].description).toBe('GET /b')
  })

  it('still scrubs event.request.url (pre-existing PII-1 behaviour, unchanged)', async () => {
    const config = await loadInit()
    const event = config.beforeSendTransaction({
      request: { url: '/api/parliament/lookup?postalCode=V8B0A1', query_string: 'postalCode=V8B0A1' },
    })
    expect(event.request.url).toBeUndefined()
    expect(event.request.query_string).toBeUndefined()
  })
})
