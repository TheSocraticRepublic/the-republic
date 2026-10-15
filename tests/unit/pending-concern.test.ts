// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/*
 * UI plan C4: the pending concern, bound to one anonymous-to-login handoff in
 * one tab.
 *
 * Real code throughout: `@/lib/pending-concern`, the sign-out helper and its
 * listeners, the landing's closing box, the login page and the concern form,
 * rendered in jsdom with jsdom's real sessionStorage. Replaced: `fetch`,
 * `window.location` (jsdom does not navigate) and `BroadcastChannel`, by a
 * fake that keeps the real delivery rule (every OTHER open channel of the
 * same name hears a message, never the object that posted it). jsdom has one
 * sessionStorage, so "another tab" here is another channel object posting
 * into this tab; the two-real-tabs cases are on the harness
 * (pending-concern-tabs.test.ts).
 */

const ORIGIN = 'http://127.0.0.1:3177'
const ID_A = '0123456789abcdef0123456789abcdef'
const ID_B = 'fedcba9876543210fedcba9876543210'
const KEY = 'oc:pending-concern'

vi.mock('next/navigation', () => ({
  usePathname: () => '/investigate',
  useRouter: () => ({ push: vi.fn(), replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

class FakeChannel {
  static open: FakeChannel[] = []
  static posted: Array<{ name: string; data: unknown }> = []
  name: string
  closed = false
  private listeners = new Set<(e: MessageEvent) => void>()
  constructor(name: string) {
    this.name = name
    FakeChannel.open.push(this)
  }
  postMessage(data: unknown) {
    FakeChannel.posted.push({ name: this.name, data })
    const copy = JSON.parse(JSON.stringify(data))
    for (const other of FakeChannel.open) {
      if (other === this || other.closed || other.name !== this.name) continue
      for (const l of other.listeners) l(new MessageEvent('message', { data: copy }))
    }
  }
  addEventListener(type: string, l: (e: MessageEvent) => void) {
    if (type === 'message') this.listeners.add(l)
  }
  removeEventListener(type: string, l: (e: MessageEvent) => void) {
    if (type === 'message') this.listeners.delete(l)
  }
  close() {
    this.closed = true
  }
}

/** Another tab: its own channel on 'oc-auth', recording what it hears. */
function otherTab() {
  const ch = new FakeChannel('oc-auth')
  const heard: unknown[] = []
  ch.addEventListener('message', (e) => heard.push(e.data))
  return { ch, heard }
}

let assign: ReturnType<typeof vi.fn>
let reload: ReturnType<typeof vi.fn>
const realLocation = window.location
function setLocation(pathname: string, search = '') {
  assign = vi.fn()
  reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: ORIGIN, href: `${ORIGIN}${pathname}${search}`, pathname, search, assign, reload },
  })
}

type Reply = () => Promise<Partial<Response>>
const replies = new Map<string, Reply>()
let fetchLog: Array<{ url: string; init?: RequestInit; storedAtCall: string | null }>
const status = (code: number, body: unknown = {}): Reply => async () => ({
  type: 'basic' as ResponseType,
  ok: code >= 200 && code < 300,
  status: code,
  json: async () => body,
})
const opaqueRedirect: Reply = async () => ({ type: 'opaqueredirect' as ResponseType, ok: false, status: 0 })

let pc: typeof import('@/lib/pending-concern')
let auth: typeof import('@/lib/auth/client-sign-out')

beforeEach(async () => {
  FakeChannel.open = []
  FakeChannel.posted = []
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  )
  replies.clear()
  fetchLog = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchLog.push({ url, init, storedAtCall: window.sessionStorage.getItem(KEY) })
      const reply = replies.get(url)
      if (!reply) throw new Error(`unexpected fetch ${url}`)
      return reply()
    })
  )
  setLocation('/')
  window.sessionStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  pc = await import('@/lib/pending-concern')
  auth = await import('@/lib/auth/client-sign-out')
  auth.resetAuthChannelForTests()
})

afterEach(() => {
  cleanup()
  auth.resetAuthChannelForTests()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

const NOW = 1_800_000_000_000
function store(record: unknown) {
  window.sessionStorage.setItem(KEY, typeof record === 'string' ? record : JSON.stringify(record))
}
const good = (over: Record<string, unknown> = {}) => ({ v: 1, text: 'A gravel pit by the river', savedAt: Date.now(), handoff: ID_A, ...over })

// ---- the record ----------------------------------------------------------------

describe('a stored record: what is kept and what is discarded', () => {
  it('a well-formed record parses', () => {
    expect(pc.parsePendingConcern(JSON.stringify(good({ savedAt: NOW })), NOW)).toEqual({
      v: 1,
      text: 'A gravel pit by the river',
      savedAt: NOW,
      handoff: ID_A,
    })
  })

  it.each([
    ['not JSON', '{v:1'],
    ['null', 'null'],
    ['an array', '[1]'],
    ['a string', '"text"'],
    ['version 2', JSON.stringify(good({ v: 2, savedAt: NOW }))],
    ['no version', JSON.stringify({ text: 't', savedAt: NOW, handoff: ID_A })],
    ['text a number', JSON.stringify(good({ text: 42, savedAt: NOW }))],
    ['text missing', JSON.stringify({ v: 1, savedAt: NOW, handoff: ID_A })],
    ['oversized text (2,001 characters)', JSON.stringify(good({ text: 'x'.repeat(2001), savedAt: NOW }))],
    ['savedAt a string', JSON.stringify(good({ savedAt: String(NOW) }))],
    ['savedAt null (what JSON makes of NaN)', JSON.stringify(good({ savedAt: NaN }))],
    ['savedAt Infinity (1e999)', `{"v":1,"text":"t","savedAt":1e999,"handoff":"${ID_A}"}`],
    ['savedAt -Infinity (-1e999)', `{"v":1,"text":"t","savedAt":-1e999,"handoff":"${ID_A}"}`],
    ['savedAt 61 s in the future', JSON.stringify(good({ savedAt: NOW + 61_000 }))],
    ['savedAt 60 min and 1 ms old', JSON.stringify(good({ savedAt: NOW - 3_600_001 }))],
    ['no handoff', JSON.stringify({ v: 1, text: 't', savedAt: NOW })],
    ['a malformed handoff', JSON.stringify(good({ savedAt: NOW, handoff: 'not-an-id' }))],
  ])('%s is discarded', (_label, raw) => {
    expect(pc.parsePendingConcern(raw, NOW)).toBeNull()
  })

  it('NaN savedAt is discarded (the finite-number check; NaN fails both window comparisons)', () => {
    expect(pc.validatePendingConcern({ v: 1, text: 't', savedAt: NaN, handoff: ID_A }, NOW)).toBeNull()
    // The same record with a finite savedAt is kept, so it is the NaN alone.
    expect(pc.validatePendingConcern({ v: 1, text: 't', savedAt: NOW, handoff: ID_A }, NOW)).not.toBeNull()
  })

  it('the edges are kept: 2,000 characters, 60 s ahead, exactly 60 min old', () => {
    expect(pc.parsePendingConcern(JSON.stringify(good({ text: 'x'.repeat(2000), savedAt: NOW })), NOW)).not.toBeNull()
    expect(pc.parsePendingConcern(JSON.stringify(good({ savedAt: NOW + 60_000 })), NOW)).not.toBeNull()
    expect(pc.parsePendingConcern(JSON.stringify(good({ savedAt: NOW - 3_600_000 })), NOW)).not.toBeNull()
  })

  it('reading a bad record deletes it from storage', () => {
    store('{broken')
    expect(pc.readPendingConcern()).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('a write stores {v:1, text, savedAt, handoff} under oc:pending-concern', () => {
    expect(pc.writePendingConcern('My concern', ID_A, NOW)).toBe(true)
    expect(JSON.parse(window.sessionStorage.getItem(KEY)!)).toStrictEqual({ v: 1, text: 'My concern', savedAt: NOW, handoff: ID_A })
  })

  it('a write refuses empty or oversized text and a malformed id', () => {
    expect(pc.writePendingConcern('', ID_A)).toBe(false)
    expect(pc.writePendingConcern('x'.repeat(2001), ID_A)).toBe(false)
    expect(pc.writePendingConcern('ok', 'ABC')).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('a new handoff id is 128 random bits as 32 hex characters, different each time', () => {
    const a = pc.newHandoffId()
    const b = pc.newHandoffId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(pc.isHandoffId(a)).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('storage that throws is a no-op', () => {
  it('a full quota on write: false, nothing thrown', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(pc.writePendingConcern('text', ID_A)).toBe(false)
  })

  it('read, delete and take when every call throws: null, nothing thrown', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(pc.readPendingConcern()).toBeNull()
    expect(() => pc.clearPendingConcern()).not.toThrow()
    expect(pc.takePendingConcern(ID_A)).toBeNull()
  })

  it('window.sessionStorage itself throwing (storage disabled): every operation is a no-op', () => {
    const spy = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(pc.writePendingConcern('text', ID_A)).toBe(false)
    expect(pc.readPendingConcern()).toBeNull()
    expect(() => pc.clearPendingConcern()).not.toThrow()
    expect(() => pc.applyAuthMessageToPendingConcern({ type: 'signed-in', handoff: ID_B })).not.toThrow()
    spy.mockRestore()
  })
})

// ---- the handoff id through the login redirect --------------------------------

describe('the handoff id survives safeRedirectTarget, and a malformed one is refused on read', () => {
  it('the login URL carries /investigate?handoff=<id> as one redirect value, and the checked target keeps it', async () => {
    const { safeRedirectTarget } = await import('@/lib/navigation/safe-redirect')
    // One encoded value, so no consumer can split the target's own ? and =.
    expect(pc.loginUrlForHandoff(ID_A)).toBe(`/login?redirect=%2Finvestigate%3Fhandoff%3D${ID_A}`)
    const login = new URL(pc.loginUrlForHandoff(ID_A), ORIGIN)
    expect(login.pathname).toBe('/login')
    const raw = login.searchParams.get('redirect')
    expect(raw).toBe(`/investigate?handoff=${ID_A}`)
    const target = safeRedirectTarget(raw, ORIGIN)
    expect(target).toBe(`${ORIGIN}/investigate?handoff=${ID_A}`)
    expect(pc.handoffFromTarget(target)).toBe(ID_A)
    expect(pc.handoffFromSearch(new URL(target).search)).toBe(ID_A)
  })

  it.each([
    ['too short', ID_A.slice(1)],
    ['too long', `${ID_A}0`],
    ['upper case', ID_A.toUpperCase()],
    ['not hex', 'g'.repeat(32)],
    ['markup', '<script>alert(1)</script>'],
    ['empty', ''],
  ])('a handoff that is %s is refused', (_label, bad) => {
    expect(pc.handoffFromSearch(`?handoff=${encodeURIComponent(bad)}`)).toBeNull()
    expect(pc.handoffFromTarget(`${ORIGIN}/investigate?handoff=${encodeURIComponent(bad)}`)).toBeNull()
  })

  it('only an Investigate target carries a handoff', () => {
    expect(pc.handoffFromTarget(`${ORIGIN}/votes?handoff=${ID_A}`)).toBeNull()
    expect(pc.handoffFromTarget('/investigate?handoff=' + ID_A)).toBeNull() // not absolute
    expect(pc.handoffFromSearch('')).toBeNull()
  })

  it('a "//" redirect is refused whole, so it carries no handoff either', async () => {
    const { safeRedirectTarget } = await import('@/lib/navigation/safe-redirect')
    const target = safeRedirectTarget(`//evil.example/investigate?handoff=${ID_A}`, ORIGIN)
    expect(target).toBe(`${ORIGIN}/investigate`)
    expect(pc.handoffFromTarget(target)).toBeNull()
  })
})

// ---- the one offer ---------------------------------------------------------------

describe('takePendingConcern: offered only on the matching handoff, deleted as it is offered', () => {
  it('a matching handoff returns the record and deletes it; a second take (a reload) finds nothing', () => {
    store(good())
    expect(pc.takePendingConcern(ID_A)?.text).toBe('A gravel pit by the river')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(pc.takePendingConcern(ID_A)).toBeNull()
  })

  it('another handoff, or none, returns nothing and leaves the record alone', () => {
    store(good())
    expect(pc.takePendingConcern(ID_B)).toBeNull()
    expect(pc.takePendingConcern(null)).toBeNull()
    expect(pc.readPendingConcern()?.handoff).toBe(ID_A)
  })

  it('a stale record is not offered, even on its own handoff', () => {
    store(good({ savedAt: Date.now() - 3_600_001 }))
    expect(pc.takePendingConcern(ID_A)).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })
})

// ---- other tabs ------------------------------------------------------------------

describe('an oc-auth message from another tab', () => {
  it.each([
    ['signed-out', { type: 'signed-out' }],
    ['clear-pending', { type: 'clear-pending' }],
    ['signed-in on another handoff', { type: 'signed-in', handoff: ID_B }],
    ['signed-in on no handoff', { type: 'signed-in' }],
    ['signed-in with a malformed handoff', { type: 'signed-in', handoff: 'x' }],
  ])('%s deletes this tab\'s record', (_label, msg) => {
    store(good())
    pc.applyAuthMessageToPendingConcern(msg)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('signed-in on THIS record\'s handoff keeps it (only the tab holding that id)', () => {
    store(good())
    pc.applyAuthMessageToPendingConcern({ type: 'signed-in', handoff: ID_A })
    expect(pc.readPendingConcern()?.handoff).toBe(ID_A)
  })

  it.each([null, 'signed-out', { kind: 'signed-out' }, { type: 'other' }])('%j leaves it alone', (msg) => {
    store(good())
    pc.applyAuthMessageToPendingConcern(msg)
    expect(pc.readPendingConcern()).not.toBeNull()
  })
})

describe('the app listener (listenForSignOutElsewhere) deletes the pending concern', () => {
  it('on clear-pending: deleted, and no reload, no notice', () => {
    store(good())
    const stop = auth.listenForSignOutElsewhere()
    new FakeChannel('oc-auth').postMessage({ type: 'clear-pending' })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('on signed-out: deleted (and the tab reloads, as C3 does)', () => {
    store(good())
    const stop = auth.listenForSignOutElsewhere()
    new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })

  it('on signed-in: a different handoff deletes, the same one keeps; neither reloads', () => {
    store(good())
    const stop = auth.listenForSignOutElsewhere()
    const tab2 = new FakeChannel('oc-auth')
    tab2.postMessage({ type: 'signed-in', handoff: ID_A })
    expect(pc.readPendingConcern()?.handoff).toBe(ID_A)
    tab2.postMessage({ type: 'signed-in', handoff: ID_B })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('the signed-out pages\' listener (listenForPendingConcernClears) deletes on all three, and never reloads', () => {
    const stop = auth.listenForPendingConcernClears()
    const tab2 = new FakeChannel('oc-auth')
    for (const msg of [{ type: 'clear-pending' }, { type: 'signed-out' }, { type: 'signed-in', handoff: ID_B }]) {
      store(good())
      tab2.postMessage(msg)
      expect(window.sessionStorage.getItem(KEY)).toBeNull()
    }
    expect(reload).not.toHaveBeenCalled()
    stop()
    store(good())
    tab2.postMessage({ type: 'signed-out' })
    expect(window.sessionStorage.getItem(KEY)).not.toBeNull()
  })
})

describe('a sign-out clears the pending concern before its request, even when it fails', () => {
  it.each([
    ['500', status(500)],
    ['no network', async () => Promise.reject(new TypeError('Failed to fetch'))],
    ['success', status(200, { signedOut: true })],
  ] as Array<[string, Reply]>)('%s: this tab\'s record is gone before the request; other tabs hear clear-pending first', async (_label, reply) => {
    store(good())
    replies.set('/api/auth/signout', reply)
    const tab2 = otherTab()
    const result = await auth.clientSignOut()
    expect(fetchLog).toHaveLength(1)
    expect(fetchLog[0].storedAtCall).toBeNull()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(tab2.heard[0]).toEqual({ type: 'clear-pending' })
    if (result.ok) {
      expect(tab2.heard).toEqual([{ type: 'clear-pending' }, { type: 'signed-out' }])
    } else {
      // A failed sign-out never says signed-out, so no other tab reloads.
      expect(tab2.heard).toEqual([{ type: 'clear-pending' }])
    }
  })

  it('a failed sign-out in another tab clears this tab without reloading it', async () => {
    store(good())
    const stop = auth.listenForSignOutElsewhere()
    // Tab 2's helper sends exactly this before its request fails.
    new FakeChannel('oc-auth').postMessage({ type: 'clear-pending' })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    expect(auth.hasUnsavedWork()).toBe(false)
    stop()
  })
})

// ---- the landing's closing box -----------------------------------------------------

async function renderLanding() {
  const { LandingCta } = await import('@/components/landing/landing-cta')
  await act(async () => {
    render(h(LandingCta))
  })
  return screen.getByRole('textbox', { name: 'What concerns you?' }) as HTMLTextAreaElement
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('the landing writes the record only while signed out', () => {
  it('signed out (the probe is redirected): writes the record and goes to the login carrying the same handoff', async () => {
    replies.set('/investigate', opaqueRedirect)
    const box = await renderLanding()
    fireEvent.change(box, { target: { value: '  A rezoning across from the daycare  ' } })
    await press('Start an investigation')
    expect(fetchLog.map((c) => [c.url, c.init?.method, c.init?.redirect])).toEqual([['/investigate', 'HEAD', 'manual']])
    // Nothing of the text left the browser in the probe.
    expect(JSON.stringify(fetchLog[0].init)).not.toContain('rezoning')
    const record = pc.readPendingConcern()!
    expect(record.text).toBe('A rezoning across from the daycare')
    expect(assign).toHaveBeenCalledTimes(1)
    const to = new URL(assign.mock.calls[0][0])
    expect(to.origin).toBe(ORIGIN)
    expect(to.pathname).toBe('/login')
    expect(to.searchParams.get('redirect')).toBe(`/investigate?handoff=${record.handoff}`)
  })

  it('signed in (the probe answers 200): no record, straight to Investigate', async () => {
    replies.set('/investigate', status(200))
    const box = await renderLanding()
    fireEvent.change(box, { target: { value: 'A cutting permit' } })
    await press('Start an investigation')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/investigate`)
  })

  it('a probe that cannot answer is treated as signed out: the login is safe either way', async () => {
    const box = await renderLanding() // no reply registered: fetch rejects
    fireEvent.change(box, { target: { value: 'A cutting permit' } })
    await press('Start an investigation')
    expect(pc.readPendingConcern()?.text).toBe('A cutting permit')
    expect(new URL(assign.mock.calls[0][0]).pathname).toBe('/login')
  })

  it('storage refusing the write still goes to the login (the carry is lost, not the page)', async () => {
    replies.set('/investigate', opaqueRedirect)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const box = await renderLanding()
    fireEvent.change(box, { target: { value: 'A cutting permit' } })
    await press('Start an investigation')
    expect(new URL(assign.mock.calls[0][0]).pathname).toBe('/login')
  })

  it('an empty box sends nothing and says why', async () => {
    await renderLanding()
    await press('Start an investigation')
    expect(fetchLog).toHaveLength(0)
    expect(assign).not.toHaveBeenCalled()
    expect(screen.getByText('Describe your concern to start.')).toBeTruthy()
  })

  it('has the helper line, the 2,000-character limit, and touch-size pills', async () => {
    const box = await renderLanding()
    expect(box.maxLength).toBe(2000)
    expect(box.getAttribute('aria-describedby')).toBe('landing-concern-helper')
    expect(document.getElementById('landing-concern-helper')?.textContent).toBe("You'll sign in with an email code. No password.")
    const heading = screen.getByRole('heading', { level: 2, name: 'What concerns you?' })
    // Fraunces (the display face) at clamp(28px,3vw,36px).
    expect(heading.className).toContain('font-display')
    expect(heading.className).toContain('text-[length:clamp(28px,3vw,36px)]')
    const pill = screen.getByRole('link', { name: 'Scout' })
    expect(pill.className).toContain('py-2.5')
    expect(pill.className).toContain('pointer-coarse:min-h-11')
  })

  it('the landing tab listens: another tab signing in on another handoff deletes its record', async () => {
    await renderLanding()
    store(good())
    new FakeChannel('oc-auth').postMessage({ type: 'signed-in', handoff: ID_B })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })
})

// ---- the login page ---------------------------------------------------------------

async function loginThrough(search: string) {
  setLocation('/login', search)
  replies.set('/api/auth/send-code', status(200, { ok: true, sent: true }))
  replies.set('/api/auth/verify-code', status(200, { success: true }))
  const { default: LoginPage } = await import('@/app/(auth)/login/page')
  await act(async () => {
    render(h(LoginPage))
  })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'qa-owner-a@example.test' } })
  await press('Send code')
  fireEvent.change(screen.getByLabelText('8-digit code'), { target: { value: '12345678' } })
  await press('Verify code')
}

describe('a successful login broadcasts signed-in with the handoff it completes', () => {
  it('?redirect=/investigate?handoff=<id>: tells other tabs that id, and lands on the target with it', async () => {
    const tab2 = otherTab()
    await loginThrough(`?redirect=${encodeURIComponent(`/investigate?handoff=${ID_A}`)}`)
    expect(tab2.heard).toEqual([{ type: 'signed-in', handoff: ID_A }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/investigate?handoff=${ID_A}`)
  })

  it('a malformed handoff is not broadcast (the target still goes through; Investigate refuses it)', async () => {
    const tab2 = otherTab()
    await loginThrough(`?redirect=${encodeURIComponent('/investigate?handoff=<script>')}`)
    expect(tab2.heard).toEqual([{ type: 'signed-in' }])
  })

  it('no redirect: signed-in with no handoff', async () => {
    const tab2 = otherTab()
    await loginThrough('')
    expect(tab2.heard).toEqual([{ type: 'signed-in' }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/investigate`)
  })

  // Razor C4 W1: the broadcast never reaches the tab that posts it, so the
  // login applies the handoff rule to its own tab before it moves.
  it.each([
    ['plain /login (no redirect)', ''],
    ['a redirect with no handoff', `?redirect=${encodeURIComponent('/votes')}`],
    ['another handoff', `?redirect=${encodeURIComponent(`/investigate?handoff=${ID_B}`)}`],
    ['a malformed handoff', `?redirect=${encodeURIComponent('/investigate?handoff=zz')}`],
  ])('W1: a login completing %s deletes the record left in its own tab', async (_label, search) => {
    store(good())
    await loginThrough(search)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('W1: a login completing this record\'s own handoff keeps it for Investigate', async () => {
    store(good())
    await loginThrough(`?redirect=${encodeURIComponent(`/investigate?handoff=${ID_A}`)}`)
    expect(pc.readPendingConcern()?.handoff).toBe(ID_A)
  })

  it('W1: keepPendingConcernOnlyFor drops a held offer too when the handoff differs', () => {
    store(good())
    const dropped = vi.fn()
    const stop = pc.onPendingConcernRevoked(dropped)
    pc.keepPendingConcernOnlyFor(ID_A)
    expect(dropped).not.toHaveBeenCalled()
    pc.keepPendingConcernOnlyFor(null)
    expect(dropped).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    stop()
  })

  it('a failed verify broadcasts nothing and leaves the record alone', async () => {
    store(good({ handoff: ID_B }))
    const tab2 = otherTab()
    setLocation('/login', `?redirect=${encodeURIComponent(`/investigate?handoff=${ID_A}`)}`)
    replies.set('/api/auth/send-code', status(200, { ok: true, sent: true }))
    replies.set('/api/auth/verify-code', status(401, { error: 'invalid' }))
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    await act(async () => {
      render(h(LoginPage))
    })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@example.test' } })
    await press('Send code')
    fireEvent.change(screen.getByLabelText('8-digit code'), { target: { value: '12345678' } })
    await press('Verify code')
    expect(tab2.heard).toEqual([])
    expect(assign).not.toHaveBeenCalled()
    // Nobody signed in, so the record waits.
    expect(pc.readPendingConcern()?.handoff).toBe(ID_B)
  })

  it('the login tab listens: another tab\'s sign-in on a different handoff deletes the record waiting here', async () => {
    setLocation('/login', `?redirect=${encodeURIComponent(`/investigate?handoff=${ID_A}`)}`)
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    await act(async () => {
      render(h(LoginPage))
    })
    store(good())
    new FakeChannel('oc-auth').postMessage({ type: 'signed-in', handoff: ID_B })
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })
})

// ---- the concern form on Investigate -----------------------------------------------

async function renderForm(search: string) {
  setLocation('/investigate', search)
  replies.set('/api/mirror/jurisdictions', status(200, { jurisdictions: [] }))
  const { ConcernForm } = await import('@/components/investigation/concern-form')
  await act(async () => {
    render(h(ConcernForm))
  })
}

describe('Investigate offers the carried concern once, on its handoff', () => {
  it('the matching handoff: offered (not prefilled), and gone from storage as it renders', async () => {
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    expect(screen.getByText('You wrote a concern before signing in.')).toBeTruthy()
    expect(screen.getByText('A gravel pit by the river')).toBeTruthy()
    expect((screen.getByLabelText('Describe your concern') as HTMLTextAreaElement).value).toBe('')
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('Use it fills the box; Discard drops it', async () => {
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    await press('Use it')
    expect((screen.getByLabelText('Describe your concern') as HTMLTextAreaElement).value).toBe('A gravel pit by the river')
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
    cleanup()
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    await press('Discard')
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
    expect((screen.getByLabelText('Describe your concern') as HTMLTextAreaElement).value).toBe('')
  })

  it('a reload (a second render on the same URL) offers nothing', async () => {
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    cleanup()
    await renderForm(`?handoff=${ID_A}`)
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
  })

  it.each([
    ['no handoff in the URL', ''],
    ['another handoff', `?handoff=${ID_B}`],
    ['a malformed handoff', '?handoff=nope'],
  ])('%s: nothing offered', async (_label, search) => {
    store(good())
    await renderForm(search)
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
  })

  it('a sign-out in another tab while the offer is held removes the held copy too', async () => {
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    const stop = auth.listenForSignOutElsewhere()
    // Typed text keeps this tab from reloading, so the held copy must go by itself.
    fireEvent.change(screen.getByLabelText('Describe your concern'), { target: { value: 'my own words' } })
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    expect(reload).not.toHaveBeenCalled()
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
    expect(screen.queryByText('A gravel pit by the river')).toBeNull()
    stop()
  })

  it('a clear-pending from another tab removes the held copy, without a reload', async () => {
    store(good())
    await renderForm(`?handoff=${ID_A}`)
    const stop = auth.listenForSignOutElsewhere()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'clear-pending' })
    })
    expect(screen.queryByText('You wrote a concern before signing in.')).toBeNull()
    expect(reload).not.toHaveBeenCalled()
    stop()
  })
})

describe('the concern form: C3 dirty-draft registry and the C2b Field recipe', () => {
  it('typed text registers unsaved work; clearing it unregisters', async () => {
    await renderForm('')
    const box = screen.getByLabelText('Describe your concern')
    expect(auth.hasUnsavedWork()).toBe(false)
    fireEvent.change(box, { target: { value: 'something' } })
    expect(auth.hasUnsavedWork()).toBe(true)
    fireEvent.change(box, { target: { value: '   ' } })
    expect(auth.hasUnsavedWork()).toBe(false)
  })

  it('a sign-out elsewhere with typed text shows the notice and keeps the text', async () => {
    await renderForm('')
    const stop = auth.listenForSignOutElsewhere()
    fireEvent.change(screen.getByLabelText('Describe your concern'), { target: { value: 'keep me' } })
    new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    expect(reload).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Describe your concern') as HTMLTextAreaElement).value).toBe('keep me')
    stop()
  })

  it('jurisdiction and postal code use the Field label, description and control', async () => {
    const { FIELD_LABEL_CLASS, fieldControlClass } = await import('@/components/ui/field')
    await renderForm('')
    const select = screen.getByLabelText(/^Jurisdiction/) as HTMLSelectElement
    const postal = screen.getByLabelText(/^Postal code/) as HTMLInputElement
    for (const [control, kind, description] of [
      [select, 'select', 'The city, district or province your concern is about. It helps find the right documents.'],
      [postal, 'input', 'Shows how your MP voted on related issues.'],
    ] as const) {
      const label = document.querySelector(`label[for="${control.id}"]`)!
      expect(label.className).toBe(FIELD_LABEL_CLASS)
      expect(label.textContent).toMatch(/ \(optional\)$/)
      expect(control.className).toContain(fieldControlClass(kind))
      const describedBy = control.getAttribute('aria-describedby')!
      expect(document.getElementById(describedBy)?.textContent).toBe(description)
    }
  })

  it('keeps B3a\'s reason line and the Start box', async () => {
    await renderForm('')
    expect(screen.getByText('Describe your concern to start.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start Investigation' }).getAttribute('aria-disabled')).toBe('true')
  })
})
