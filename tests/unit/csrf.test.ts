import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { checkCsrfOrigin } from '@/lib/api/csrf'

function makeRequest(method: string, origin?: string, host?: string): NextRequest {
  const headers = new Headers()
  if (origin) headers.set('origin', origin)
  if (host) headers.set('host', host)
  return new NextRequest(new URL('https://opencave.ca/api/auth/send-code'), {
    method,
    headers,
  })
}

describe('checkCsrfOrigin', () => {
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXT_PUBLIC_APP_URL = 'https://opencave.ca'
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env.NEXT_PUBLIC_APP_URL = origAppUrl
  })

  it('skips check in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = makeRequest('POST')
    expect(checkCsrfOrigin(req)).toBeNull()
  })

  it('skips check for GET requests', () => {
    const req = makeRequest('GET')
    expect(checkCsrfOrigin(req)).toBeNull()
  })

  it('passes when origin matches app URL', () => {
    const req = makeRequest('POST', 'https://opencave.ca', 'opencave.ca')
    expect(checkCsrfOrigin(req)).toBeNull()
  })

  it('passes when origin matches https://${host} alias', () => {
    // host header creates an alias — origin matching that alias passes
    const req = makeRequest('POST', 'https://deploy-preview-42.opencave.ca', 'deploy-preview-42.opencave.ca')
    expect(checkCsrfOrigin(req)).toBeNull()
  })

  it('rejects when origin matches neither app URL nor host alias', () => {
    const req = makeRequest('POST', 'https://evil.com', 'deploy-preview-42.opencave.ca')
    const result = checkCsrfOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('rejects when origin does not match', () => {
    const req = makeRequest('POST', 'https://evil.com', 'opencave.ca')
    const result = checkCsrfOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('rejects when origin is missing', () => {
    const req = makeRequest('POST', undefined, 'opencave.ca')
    const result = checkCsrfOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })

  it('rejects when NEXT_PUBLIC_APP_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const req = makeRequest('POST', 'https://opencave.ca', 'opencave.ca')
    const result = checkCsrfOrigin(req)
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })
})
