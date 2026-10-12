/**
 * Same-origin redirect targets from untrusted input (a `?redirect=` parameter).
 *
 * Why this is more than "starts with / and not //": browsers and the WHATWG URL
 * parser rewrite the string before they navigate. A backslash is read as a
 * slash (`/\evil.example` becomes `//evil.example`), tabs and newlines are
 * stripped (`/\t/evil` becomes `//evil`), and dot segments are collapsed, so a
 * path that looked safe can serialise to `//evil.example`. Returning a
 * re-serialised path (`pathname + search + hash`) hands that string back to
 * the browser as a protocol-relative URL: an open redirect.
 *
 * So the helper checks the raw string, checks it again once percent-decoded,
 * parses it against the app's origin, and returns the parsed ABSOLUTE URL
 * (`url.href`). An absolute URL whose origin was checked cannot be re-read as
 * another host. The final origin is asserted once more before returning.
 */

/** Where a rejected or missing target sends the user. */
export const SAFE_REDIRECT_FALLBACK_PATH = '/investigate'

// Backslash, C0 controls (tab, newline, carriage return among them) and DEL.
const FORBIDDEN_CHARACTERS = /[\\\x00-\x1f\x7f]/

function hasForbiddenCharacters(value: string): boolean {
  return FORBIDDEN_CHARACTERS.test(value)
}

/**
 * The postcondition, as its own step so it is testable: `candidate` is
 * returned only if it is an absolute URL on exactly `origin`; anything else
 * (including a relative string, which `new URL` without a base rejects) yields
 * the fallback on `origin`.
 */
export function enforceSameOrigin(candidate: string, origin: string): string {
  const fallback = fallbackFor(origin)
  try {
    if (new URL(candidate).origin === origin) return candidate
  } catch {
    // Not an absolute URL: it cannot be proven same-origin, so it is refused.
  }
  return fallback
}

function fallbackFor(origin: string): string {
  // `origin` comes from `window.location.origin`. An opaque origin ("null")
  // or a malformed one has no safe target at all; say so rather than
  // navigating somewhere relative to an unknown base.
  let fallback: URL
  try {
    fallback = new URL(SAFE_REDIRECT_FALLBACK_PATH, origin)
  } catch {
    throw new Error(`safeRedirectTarget: "${origin}" is not a usable origin`)
  }
  if (fallback.origin !== origin) {
    throw new Error(`safeRedirectTarget: "${origin}" is not a serialised origin`)
  }
  return fallback.href
}

/**
 * Turn an untrusted redirect parameter into an absolute URL on `origin`.
 * Never returns a relative string, and never returns another origin: a
 * rejected input yields the fallback (`/investigate`) on `origin`.
 *
 * Callers navigate with the result as-is: `window.location.assign(result)`.
 */
export function safeRedirectTarget(raw: string | null | undefined, origin: string): string {
  const fallback = fallbackFor(origin)
  if (!raw) return fallback

  // 1. No backslash or control character, raw or once-decoded. A string that
  //    does not decode is refused too.
  if (hasForbiddenCharacters(raw)) return fallback
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return fallback
  }
  if (hasForbiddenCharacters(decoded)) return fallback

  // 2. A path on this site: starts with "/" and is not protocol-relative.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback

  // 3. Parsed against the app's origin, it must still be the app's origin.
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return fallback
  }
  if (url.origin !== origin) return fallback

  // 4 and 5. Return the absolute, already-checked URL, and assert its origin
  //    once more on the exact string being returned.
  return enforceSameOrigin(url.href, origin)
}
