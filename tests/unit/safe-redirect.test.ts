import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SAFE_REDIRECT_FALLBACK_PATH,
  enforceSameOrigin,
  safeRedirectTarget,
} from '@/lib/navigation/safe-redirect'

const ORIGIN = 'http://127.0.0.1:3177'
const FALLBACK = `${ORIGIN}${SAFE_REDIRECT_FALLBACK_PATH}`

/**
 * Where `window.location.assign(result)` on /profile/setup actually lands:
 * the browser resolves the string against the document's URL. A relative
 * result like `//evil.example` would resolve to another host here, which is
 * exactly the failure each test must rule out.
 */
function navigatedOrigin(result: string): string {
  return new URL(result, `${ORIGIN}/profile/setup?redirect=x`).origin
}

describe('safeRedirectTarget: critic r3 escapes (normaliser turns a path into //host)', () => {
  it.each(['/.//evil.example', '/a/..//evil.example', '/%2e//evil.example'])(
    '%s stays on the app origin and comes back absolute',
    (raw) => {
      const result = safeRedirectTarget(raw, ORIGIN)
      expect(navigatedOrigin(result)).toBe(ORIGIN)
      // Absolute: a relative re-serialisation ("//evil.example") is the leak.
      expect(result.startsWith(`${ORIGIN}/`)).toBe(true)
      expect(new URL(result).origin).toBe(ORIGIN)
    },
  )

  it('/.//evil.example is returned as the parsed absolute URL, not its pathname', () => {
    const result = safeRedirectTarget('/.//evil.example', ORIGIN)
    expect(result).toBe(`${ORIGIN}//evil.example`)
    expect(navigatedOrigin(result)).toBe(ORIGIN)
  })
})

describe('safeRedirectTarget: backslash and control characters are refused', () => {
  it.each([
    '/\\evil.example',
    '/%5Cevil.example',
    '/%5cevil.example',
    '/\t/evil',
    '/%09/evil',
    '/\n/evil',
    '/%0A/evil',
    '/\x7f/evil',
    '/%7F/evil',
  ])('%j falls back on the app origin', (raw) => {
    const result = safeRedirectTarget(raw, ORIGIN)
    expect(result).toBe(FALLBACK)
    expect(navigatedOrigin(result)).toBe(ORIGIN)
  })

  it('a string that does not percent-decode is refused', () => {
    const result = safeRedirectTarget('/%E0%A4%A', ORIGIN)
    expect(result).toBe(FALLBACK)
    expect(navigatedOrigin(result)).toBe(ORIGIN)
  })
})

describe('safeRedirectTarget: other hosts and schemes', () => {
  it.each(['//evil', '/%2F/evil', 'javascript:alert(1)', 'https://evil.example', '', 'investigate'])(
    '%j ends on the app origin',
    (raw) => {
      const result = safeRedirectTarget(raw, ORIGIN)
      expect(navigatedOrigin(result)).toBe(ORIGIN)
      expect(new URL(result).origin).toBe(ORIGIN)
    },
  )

  it.each(['//evil', 'javascript:alert(1)', 'https://evil.example', '', 'investigate'])(
    '%j is refused outright',
    (raw) => {
      expect(safeRedirectTarget(raw, ORIGIN)).toBe(FALLBACK)
    },
  )

  it('a protocol-relative path is refused even when it names this host', () => {
    // Step 2 is a rule of its own, not only a consequence of the origin check.
    // (A path other than the fallback's, so acceptance can't masquerade as refusal.)
    expect(safeRedirectTarget('//127.0.0.1:3177/lever', ORIGIN)).toBe(FALLBACK)
  })

  it('/%2F/evil stays an encoded path on this site', () => {
    expect(safeRedirectTarget('/%2F/evil', ORIGIN)).toBe(`${ORIGIN}/%2F/evil`)
  })

  it('null and undefined fall back', () => {
    expect(safeRedirectTarget(null, ORIGIN)).toBe(FALLBACK)
    expect(safeRedirectTarget(undefined, ORIGIN)).toBe(FALLBACK)
  })
})

describe('safeRedirectTarget: legitimate targets', () => {
  it('/investigate?x=1#h passes and keeps its path, query and hash', () => {
    const result = safeRedirectTarget('/investigate?x=1#h', ORIGIN)
    expect(result).toBe(`${ORIGIN}/investigate?x=1#h`)
    expect(navigatedOrigin(result)).toBe(ORIGIN)
    const url = new URL(result)
    expect(url.pathname).toBe('/investigate')
    expect(url.search).toBe('?x=1')
    expect(url.hash).toBe('#h')
  })

  it('an encoded path segment survives (the decode is a check, not a rewrite)', () => {
    expect(safeRedirectTarget('/lever/a%20b', ORIGIN)).toBe(`${ORIGIN}/lever/a%20b`)
  })
})

describe('safeRedirectTarget: the origin argument', () => {
  it('refuses an opaque origin instead of navigating relative to it', () => {
    expect(() => safeRedirectTarget('/investigate', 'null')).toThrow(/not a usable origin/)
  })

  it('refuses an origin that is not in serialised form', () => {
    expect(() => safeRedirectTarget('/investigate', `${ORIGIN}/`)).toThrow(/not a serialised origin/)
  })
})

describe('the postcondition', () => {
  it('enforceSameOrigin returns an absolute same-origin URL unchanged', () => {
    expect(enforceSameOrigin(`${ORIGIN}/a?b#c`, ORIGIN)).toBe(`${ORIGIN}/a?b#c`)
  })

  it.each(['https://evil.example/x', '//evil.example', '/investigate', 'http://127.0.0.1:3178/x'])(
    'enforceSameOrigin refuses %j',
    (candidate) => {
      const result = enforceSameOrigin(candidate, ORIGIN)
      expect(result).toBe(FALLBACK)
      expect(navigatedOrigin(result)).toBe(ORIGIN)
    },
  )

  describe('when the parser disagrees with itself', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('safeRedirectTarget still never returns another origin', () => {
      // Simulate a parse whose reported origin and serialised href disagree
      // (the class of bug the postcondition exists for): step 3 sees the app
      // origin, but the href it would return points elsewhere. Only the
      // postcondition, which re-parses the returned string, can catch it.
      const RealURL = URL
      class DisagreeingURL extends RealURL {
        constructor(input: string | URL, base?: string | URL) {
          super(input, base)
          if (input === '/parser-disagrees' && base !== undefined) {
            Object.defineProperty(this, 'href', { value: 'https://evil.example/' })
          }
        }
      }
      vi.stubGlobal('URL', DisagreeingURL)

      const result = safeRedirectTarget('/parser-disagrees', ORIGIN)
      expect(result).toBe(FALLBACK)
      expect(new RealURL(result).origin).toBe(ORIGIN)
    })

    it('step 3 refuses a parse that reports a foreign origin', () => {
      // The mirror case: the parse reports another origin while its href
      // still looks local. Step 3 must refuse on the reported origin alone.
      const RealURL = URL
      class ForeignOriginURL extends RealURL {
        constructor(input: string | URL, base?: string | URL) {
          super(input, base)
          if (input === '/origin-disagrees' && base !== undefined) {
            Object.defineProperty(this, 'origin', { value: 'https://evil.example' })
          }
        }
      }
      vi.stubGlobal('URL', ForeignOriginURL)

      expect(safeRedirectTarget('/origin-disagrees', ORIGIN)).toBe(FALLBACK)
    })
  })
})
