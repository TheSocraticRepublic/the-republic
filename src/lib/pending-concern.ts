/*
 * The pending concern (UI plan C4): what a signed-out citizen typed into the
 * landing's "What concerns you?" box, carried through sign-in to Investigate.
 *
 * It is bound to ONE anonymous-to-login handoff in ONE tab:
 * - The landing writes `{v:1, text, savedAt, handoff}` to this tab's
 *   sessionStorage, only after a probe says this browser is signed out, and
 *   sends the tab to `/login?redirect=/investigate?handoff=<id>`.
 * - Investigate offers it only on a render whose URL `handoff` matches the
 *   stored one, and deletes it from storage the moment it does. The text is
 *   then held in that component's state until Use or Discard; a reload before
 *   choosing loses it, on purpose.
 * - Every tab deletes its record when another tab signs out, signs in on a
 *   different handoff, or starts a sign-out (`clear-pending`), and the tab
 *   that signs out deletes its own before the request (client-sign-out.ts).
 *
 * Nothing here sends the text anywhere. sessionStorage that is missing, full
 * or throwing makes every operation a no-op: the citizen loses the carry, not
 * the page. The handoff id is not a secret (it travels in a URL and so in
 * function logs); it is a random tag that names one handoff, and it is
 * validated wherever it is read.
 */

export const PENDING_CONCERN_KEY = 'oc:pending-concern'

/** The concern form's own limit (`maxLength`), so a carried text always fits. */
export const PENDING_CONCERN_MAX_LENGTH = 2000
/** A clock running slightly ahead in another tab is tolerated; more is not. */
export const PENDING_CONCERN_FUTURE_SKEW_MS = 60_000
/** Older than this, a record is discarded on read (lazy expiry). */
export const PENDING_CONCERN_MAX_AGE_MS = 60 * 60_000

/** Where a handoff ends: the Investigate page, carrying the id. */
export const HANDOFF_PARAM = 'handoff'
export const HANDOFF_PATH = '/investigate'

export interface PendingConcern {
  v: 1
  text: string
  savedAt: number
  handoff: string
}

/** 128 random bits, as 32 lowercase hex characters. */
const HANDOFF_ID = /^[0-9a-f]{32}$/

export function isHandoffId(value: unknown): value is string {
  return typeof value === 'string' && HANDOFF_ID.test(value)
}

/** A fresh handoff id from the browser's CSPRNG. */
export function newHandoffId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** `/investigate?handoff=<id>`: the target the login redirect carries. */
export function handoffTarget(handoff: string): string {
  return `${HANDOFF_PATH}?${HANDOFF_PARAM}=${handoff}`
}

/** The login URL that completes this handoff. The target is one encoded
 *  `redirect` value, so its own `?` and `=` survive as part of it. */
export function loginUrlForHandoff(handoff: string): string {
  return `/login?redirect=${encodeURIComponent(handoffTarget(handoff))}`
}

/** The validated handoff id in a URL's query (`location.search`), or null. */
export function handoffFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(HANDOFF_PARAM)
  return isHandoffId(value) ? value : null
}

/** The validated handoff id a login is completing, read from the absolute
 *  target `safeRedirectTarget` returned. Only an Investigate target carries
 *  one; anything else (or a malformed id) is null. */
export function handoffFromTarget(target: string): string | null {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return null
  }
  if (url.pathname !== HANDOFF_PATH) return null
  return handoffFromSearch(url.search)
}

/**
 * Parse a stored value. Anything that is not exactly a version-1 record with
 * a string text of at most 2,000 characters, a finite `savedAt` not more than
 * 60 s in the future and at most 60 min old, and a well-formed handoff id is
 * null.
 */
export function parsePendingConcern(raw: string | null, now: number): PendingConcern | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const { v, text, savedAt, handoff } = data as Record<string, unknown>
  if (v !== 1) return null
  if (typeof text !== 'string' || text.length > PENDING_CONCERN_MAX_LENGTH) return null
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
  if (savedAt > now + PENDING_CONCERN_FUTURE_SKEW_MS) return null
  if (now - savedAt > PENDING_CONCERN_MAX_AGE_MS) return null
  if (!isHandoffId(handoff)) return null
  return { v: 1, text, savedAt, handoff }
}

/*
 * Storage access. `window.sessionStorage` itself can throw (a sandboxed frame,
 * storage disabled), as can every call on it (a full quota). Each failure is
 * logged by name only, never with the text, and the operation does nothing.
 */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch (err) {
    warn('unavailable', err)
    return null
  }
}

function warn(what: string, err: unknown) {
  console.warn(`[pending-concern] storage ${what}:`, err instanceof Error ? err.name : 'unknown error')
}

/** Write the record. Returns false (and writes nothing) when the text is out
 *  of bounds, the id is malformed or storage refuses. */
export function writePendingConcern(text: string, handoff: string, now: number = Date.now()): boolean {
  if (text.length === 0 || text.length > PENDING_CONCERN_MAX_LENGTH || !isHandoffId(handoff)) return false
  const s = storage()
  if (!s) return false
  const record: PendingConcern = { v: 1, text, savedAt: now, handoff }
  try {
    s.setItem(PENDING_CONCERN_KEY, JSON.stringify(record))
    return true
  } catch (err) {
    warn('write failed', err)
    return false
  }
}

/** Delete this tab's record, if any. */
export function clearPendingConcern(): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(PENDING_CONCERN_KEY)
  } catch (err) {
    warn('delete failed', err)
  }
}

/** This tab's valid record, or null. An invalid one is deleted on the way:
 *  anything that fails the checks is discarded on read. */
export function readPendingConcern(now: number = Date.now()): PendingConcern | null {
  const s = storage()
  if (!s) return null
  let raw: string | null
  try {
    raw = s.getItem(PENDING_CONCERN_KEY)
  } catch (err) {
    warn('read failed', err)
    return null
  }
  const record = parsePendingConcern(raw, now)
  if (raw !== null && record === null) clearPendingConcern()
  return record
}

/**
 * The Investigate render's one read. Returns the record only when the URL's
 * handoff (already validated, or null) matches the stored one, and deletes it
 * from storage in the same step, so the stored copy never outlives the one
 * render that offers it. A mismatch returns null and leaves the record alone:
 * it belongs to a handoff this render is not completing.
 */
export function takePendingConcern(urlHandoff: string | null, now: number = Date.now()): PendingConcern | null {
  if (urlHandoff === null) return null
  const record = readPendingConcern(now)
  if (!record || record.handoff !== urlHandoff) return null
  clearPendingConcern()
  return record
}

/**
 * What a tab does with its record when it hears an `oc-auth` message from
 * another tab:
 * - `signed-out` or `clear-pending`: delete it.
 * - `signed-in`: delete it unless that login completed this record's own
 *   handoff (the message's `handoff` equals the stored one).
 * Anything else leaves it alone.
 */
export function applyAuthMessageToPendingConcern(data: unknown): void {
  if (typeof data !== 'object' || data === null) return
  const { type, handoff } = data as { type?: unknown; handoff?: unknown }
  if (type === 'signed-out' || type === 'clear-pending') {
    revoke()
    return
  }
  if (type === 'signed-in') {
    const record = readPendingConcern()
    if (record && isHandoffId(handoff) && record.handoff === handoff) return
    revoke()
  }
}

/*
 * Revocation. The stored record is deleted, and so is any copy an offer on
 * this page is still holding in its state (Investigate holds the text between
 * the offer and Use or Discard): a sign-out elsewhere must not leave it on
 * screen in a tab that kept its unsaved work instead of reloading.
 */
const revokeListeners = new Set<() => void>()

function revoke(): void {
  clearPendingConcern()
  for (const l of revokeListeners) l()
}

/** Called when another tab's message revokes the pending concern. Returns
 *  the unsubscribe function (a `useEffect` cleanup). */
export function onPendingConcernRevoked(callback: () => void): () => void {
  revokeListeners.add(callback)
  return () => {
    revokeListeners.delete(callback)
  }
}

/**
 * Whether this browser is signed out, asked at the moment the citizen submits
 * the landing box (the landing is a static page and cannot know). A HEAD of
 * the Investigate page without following redirects: the middleware answers a
 * signed-out request with a redirect to /login (an `opaqueredirect`), a
 * signed-in one with the page. The request carries the cookie and nothing
 * else; the concern is not in it.
 *
 * `true` (signed out), `false` (signed in), or `null` when the answer says
 * neither (no network, a server error): the caller treats that as signed out,
 * because the login page it then goes to is safe either way.
 */
export async function probeSignedOut(): Promise<boolean | null> {
  let res: Response
  try {
    res = await fetch(HANDOFF_PATH, { method: 'HEAD', redirect: 'manual', credentials: 'same-origin', cache: 'no-store' })
  } catch (err) {
    console.warn('[pending-concern] session probe failed:', err instanceof Error ? err.name : 'unknown error')
    return null
  }
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return true
  if (res.ok) return false
  console.warn('[pending-concern] session probe answered', res.status)
  return null
}
