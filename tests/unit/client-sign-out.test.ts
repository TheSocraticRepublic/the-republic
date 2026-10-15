// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/*
 * UI plan C3: one sign-out path in the browser.
 *
 * `clientSignOut()` is exercised for real; only the network (`fetch`), the
 * browser's navigation (`window.location`) and `BroadcastChannel` are
 * replaced. The fake channel keeps the real delivery rule: a message reaches
 * every OTHER open channel of the same name, never the object that posted it.
 * Two fake channels in one test stand for two tabs.
 *
 * The callers (the sidebar and the onboarding shell) are mounted and clicked,
 * and the (app) layout is called the way Next calls it, to prove a
 * profile-less citizen on /profile/setup gets the onboarding shell.
 */

const ORIGIN = 'http://127.0.0.1:3177'
const REPO = path.resolve(__dirname, '..', '..')

// ---- next/* and the layout's lookups -----------------------------------

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => '/profile/setup',
  useRouter: () => ({ push: routerPush, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (to: string) => {
    throw Object.assign(new Error(`redirect ${to}`), { digest: `NEXT_REDIRECT;${to}` })
  },
}))

let requestHeaders: Record<string, string> = {}
vi.mock('next/headers', () => ({ headers: async () => new Headers(requestHeaders) }))

let profileRows: { displayName: string }[] = []
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => profileRows }) }) }),
  }),
}))
vi.mock('@/lib/credentials/check-moderator', () => ({
  checkModeratorAccess: async () => ({ effectiveWeight: 0 }),
}))

// ---- the fake BroadcastChannel ------------------------------------------

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
    // Structured clone, as the real channel does: the receiver never shares
    // the sender's object.
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
  get listenerCount() {
    return this.listeners.size
  }
}

// ---- fetch and location ---------------------------------------------------

type FetchCall = { url: string; init?: RequestInit; postedBefore: number }
let fetchCalls: FetchCall[]
/** What the sign-out request does: resolve with this response, or reject. */
let signOutReply: (() => Promise<Partial<Response>>) | null
let assign: ReturnType<typeof vi.fn>
let reload: ReturnType<typeof vi.fn>
const realLocation = window.location

const opaqueRedirect = async () => ({ type: 'opaqueredirect' as ResponseType, ok: false, status: 0, json: async () => { throw new TypeError('opaque') } })
const status = (code: number, body: unknown = {}) => async () => ({ type: 'basic' as ResponseType, ok: code >= 200 && code < 300, status: code, json: async () => body })
/** The route's own success answer (Razor C3 N1). */
const signedOut = status(200, { signedOut: true })

let mod: typeof import('@/lib/auth/client-sign-out')

beforeEach(async () => {
  FakeChannel.open = []
  FakeChannel.posted = []
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  fetchCalls = []
  signOutReply = signedOut
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init, postedBefore: FakeChannel.posted.length })
      if (url === '/api/auth/signout' && signOutReply) return signOutReply()
      throw new Error(`unexpected fetch ${url}`)
    })
  )
  assign = vi.fn()
  reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: ORIGIN, href: `${ORIGIN}/investigate`, pathname: '/investigate', search: '', assign, reload },
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mod = await import('@/lib/auth/client-sign-out')
  mod.resetAuthChannelForTests()
  requestHeaders = {}
  profileRows = []
})

afterEach(() => {
  cleanup()
  mod.resetAuthChannelForTests()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

/** Another tab: its own channel on the same name, recording what it hears. */
function otherTab() {
  const ch = new FakeChannel('oc-auth')
  const heard: unknown[] = []
  ch.addEventListener('message', (e) => heard.push(e.data))
  return { ch, heard }
}

// ---- clientSignOut ----------------------------------------------------------

describe('clientSignOut: the request', () => {
  it('POSTs /api/auth/signout once, same-origin, without following the redirect', async () => {
    await mod.clientSignOut()
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('/api/auth/signout')
    expect(fetchCalls[0].init?.method).toBe('POST')
    expect(fetchCalls[0].init?.redirect).toBe('manual')
    expect(fetchCalls[0].init?.credentials).toBe('same-origin')
  })

  it("treats the route's 200 {signedOut:true} as success and goes to /login", async () => {
    const result = await mod.clientSignOut()
    expect(result).toEqual({ ok: true })
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it.each([
    ['a redirect from anywhere (opaqueredirect)', opaqueRedirect],
    ['a 200 without the flag', status(200, { ok: true })],
    ['a 200 with signedOut not exactly true', status(200, { signedOut: 'yes' })],
    ['a 200 whose body is not JSON', async () => ({ type: 'basic' as ResponseType, ok: true, status: 200, json: async () => { throw new SyntaxError('html') } })],
  ] as const)('N1: %s is not a sign-out: nothing claimed, no sign-out broadcast, nothing navigated', async (_label, reply) => {
    signOutReply = reply as () => Promise<Partial<Response>>
    const tab2 = otherTab()
    expect(await mod.clientSignOut()).toEqual({ ok: false, message: mod.SIGN_OUT_REFUSED_MESSAGE })
    // Only C4's clear-pending, sent before the request; never signed-out.
    expect(tab2.heard).toEqual([{ type: 'clear-pending' }])
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('clientSignOut: the broadcast', () => {
  it("posts exactly {type:'signed-out'} on 'oc-auth', and another tab hears it", async () => {
    const tab2 = otherTab()
    await mod.clientSignOut()
    const fromHelper = FakeChannel.posted.filter(
      (p) => p.name === 'oc-auth' && (p.data as { type?: unknown }).type === 'signed-out'
    )
    expect(fromHelper).toHaveLength(1)
    // Exactly this object: no id, no email, no name, nothing else.
    expect(fromHelper[0].data).toStrictEqual({ type: 'signed-out' })
    expect(Object.keys(fromHelper[0].data as object)).toEqual(['type'])
    // C4's clear-pending first (before the request), then the sign-out.
    expect(tab2.heard).toEqual([{ type: 'clear-pending' }, { type: 'signed-out' }])
  })

  it('broadcasts signed-out only after the request has answered (clear-pending alone goes before it)', async () => {
    otherTab()
    await mod.clientSignOut()
    expect(fetchCalls[0].postedBefore).toBe(1)
    expect(FakeChannel.posted.map((p) => p.data)).toEqual([{ type: 'clear-pending' }, { type: 'signed-out' }])
  })
})

describe('clientSignOut: no BroadcastChannel', () => {
  it('still signs out and navigates when the browser has none', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    mod.resetAuthChannelForTests()
    expect(await mod.clientSignOut()).toEqual({ ok: true })
    expect(fetchCalls).toHaveLength(1)
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
    expect(FakeChannel.posted).toHaveLength(0)
  })

  it('still signs out when the constructor throws', async () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new DOMException('denied', 'SecurityError')
        }
      }
    )
    mod.resetAuthChannelForTests()
    expect(await mod.clientSignOut()).toEqual({ ok: true })
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('still signs out when posting throws', async () => {
    const tab2 = otherTab()
    vi.spyOn(FakeChannel.prototype, 'postMessage').mockImplementation(() => {
      throw new DOMException('closed', 'InvalidStateError')
    })
    expect(await mod.clientSignOut()).toEqual({ ok: true })
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
    expect(tab2.heard).toEqual([])
  })
})

describe('clientSignOut: a failed request', () => {
  it.each([
    ['no network', async () => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
    ['403 (origin refused)', status(403), 'refused'],
    ['429', status(429), 'refused'],
    ['500', status(500), 'refused'],
  ] as const)('%s: claims nothing, broadcasts no sign-out, stays put', async (_label, reply, kind) => {
    signOutReply = reply as () => Promise<Partial<Response>>
    const tab2 = otherTab()
    const result = await mod.clientSignOut()
    expect(result).toEqual({
      ok: false,
      message: kind === 'offline' ? mod.SIGN_OUT_OFFLINE_MESSAGE : mod.SIGN_OUT_REFUSED_MESSAGE,
    })
    // C4: the pending concern is still cleared everywhere (clear-pending,
    // before the request), and nothing else is sent.
    expect(FakeChannel.posted.map((p) => p.data)).toEqual([{ type: 'clear-pending' }])
    expect(tab2.heard).toEqual([{ type: 'clear-pending' }])
    expect(assign).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it("has Jen's copy: both lines say you're still signed in; only offline gets connection advice", () => {
    expect(mod.SIGN_OUT_OFFLINE_MESSAGE).toBe(
      "You're still signed in. Open Cave can't be reached. Check your connection, then sign out again."
    )
    expect(mod.SIGN_OUT_REFUSED_MESSAGE).toBe(
      "You're still signed in. Open Cave couldn't sign you out. Sign out again."
    )
    expect(mod.SIGN_OUT_REFUSED_MESSAGE).not.toContain('connection')
  })
})

// ---- the listener -------------------------------------------------------------

describe('listenForSignOutElsewhere', () => {
  it('reloads this tab when another tab signs out', () => {
    const stop = mod.listenForSignOutElsewhere()
    const tab2 = new FakeChannel('oc-auth')
    tab2.postMessage({ type: 'signed-out' })
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
  })

  it('ignores anything that is not a signed-out message', () => {
    const stop = mod.listenForSignOutElsewhere()
    const tab2 = new FakeChannel('oc-auth')
    for (const data of [null, 'signed-out', { type: 'signed-in' }, { kind: 'signed-out' }, 42]) tab2.postMessage(data)
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('ignores the same message on another channel name', () => {
    const stop = mod.listenForSignOutElsewhere()
    new FakeChannel('other').postMessage({ type: 'signed-out' })
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('stops listening when unsubscribed', () => {
    const stop = mod.listenForSignOutElsewhere()
    stop()
    new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not hear its own tab sign out (the helper and the listener share one channel)', async () => {
    const stop = mod.listenForSignOutElsewhere()
    await mod.clientSignOut()
    expect(FakeChannel.posted).toHaveLength(2)
    expect(reload).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
    stop()
  })

  it('is a no-op without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    mod.resetAuthChannelForTests()
    const stop = mod.listenForSignOutElsewhere()
    expect(typeof stop).toBe('function')
    stop()
  })
})

// ---- the callers ----------------------------------------------------------------

async function loadShell() {
  const { AppShell } = await import('@/components/layout/app-shell')
  const { Sidebar } = await import('@/components/layout/sidebar')
  return { AppShell, Sidebar }
}

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe('the sidebar uses clientSignOut', () => {
  it('Sign out posts, broadcasts and navigates', async () => {
    const { Sidebar } = await loadShell()
    const tab2 = otherTab()
    render(h(Sidebar, { displayName: 'ada' }))
    await click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fetchCalls.map((c) => c.url)).toEqual(['/api/auth/signout'])
    expect(tab2.heard).toEqual([{ type: 'clear-pending' }, { type: 'signed-out' }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('a failed sign-out shows the plain copy and stays', async () => {
    signOutReply = status(500)
    const { Sidebar } = await loadShell()
    render(h(Sidebar, { displayName: 'ada' }))
    const button = screen.getByRole('button', { name: 'Sign out' })
    await click(button)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(mod.SIGN_OUT_REFUSED_MESSAGE)
    // The error mark (C2b recipe), not colour alone (Jen C3 C4).
    expect(alert.querySelector('svg.lucide-circle-alert')).not.toBeNull()
    expect(assign).not.toHaveBeenCalled()
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  it('a second press while the first is in flight sends nothing', async () => {
    let release: (r: Partial<Response>) => void = () => {}
    signOutReply = () => new Promise((resolve) => (release = resolve))
    const { Sidebar } = await loadShell()
    render(h(Sidebar, { displayName: 'ada' }))
    const button = screen.getByRole('button', { name: 'Sign out' })
    await click(button)
    expect(button.getAttribute('aria-busy')).toBe('true')
    await click(button)
    expect(fetchCalls).toHaveLength(1)
    await act(async () => release({ type: 'basic' as ResponseType, ok: true, status: 200, json: async () => ({ signedOut: true }) }))
    expect(assign).toHaveBeenCalledTimes(1)
  })
})

describe('the onboarding shell', () => {
  it('is the wordmark and Sign out, with no instruments', async () => {
    const { AppShell } = await loadShell()
    render(h(AppShell, { variant: 'onboarding', children: h('p', null, 'setup form') }))
    expect(screen.getByText('Open Cave')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
    expect(screen.getByText('setup form')).toBeTruthy()
    expect(document.querySelector('a[href="/scout"]')).toBeNull()
    expect(document.querySelector('a[href="/profile"]')).toBeNull()
  })

  it('Sign out there uses clientSignOut too', async () => {
    const { AppShell } = await loadShell()
    const tab2 = otherTab()
    render(h(AppShell, { variant: 'onboarding', children: h('p', null, 'setup form') }))
    await click(screen.getByRole('button', { name: 'Sign out' }))
    expect(fetchCalls.map((c) => c.url)).toEqual(['/api/auth/signout'])
    expect(tab2.heard).toEqual([{ type: 'clear-pending' }, { type: 'signed-out' }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('a failed sign-out there shows the plain copy and keeps the form', async () => {
    signOutReply = async () => Promise.reject(new TypeError('Failed to fetch'))
    const { AppShell } = await loadShell()
    render(h(AppShell, { variant: 'onboarding', children: h('p', null, 'setup form') }))
    await click(screen.getByRole('button', { name: 'Sign out' }))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(mod.SIGN_OUT_OFFLINE_MESSAGE)
    expect(alert.querySelector('svg.lucide-circle-alert')).not.toBeNull()
    expect(screen.getByText('setup form')).toBeTruthy()
    expect(assign).not.toHaveBeenCalled()
  })

  it.each(['onboarding', 'app'] as const)('the %s shell listens for sign-outs in other tabs', async (variant) => {
    const { AppShell } = await loadShell()
    render(h(AppShell, { variant, displayName: 'ada', children: h('p', null, 'page') }))
    new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    expect(reload).toHaveBeenCalledTimes(1)
    cleanup()
    // Unmounted: the listener is gone.
    new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('the (app) layout picks the shell', () => {
  async function layoutElement() {
    const { default: AppLayout } = await import('@/app/(app)/layout')
    return (await AppLayout({ children: h('p', null, 'page') })) as React.ReactElement<Record<string, unknown>>
  }

  it('no profile, on /profile/setup: the onboarding shell', async () => {
    requestHeaders = { 'x-user-id': 'u1', 'x-pathname': '/profile/setup' }
    profileRows = []
    expect((await layoutElement()).props.variant).toBe('onboarding')
  })

  it('a profile, on /profile/setup (editing): the full shell', async () => {
    requestHeaders = { 'x-user-id': 'u1', 'x-pathname': '/profile/setup' }
    profileRows = [{ displayName: 'ada' }]
    const el = await layoutElement()
    expect(el.props.variant).toBe('app')
    expect(el.props.displayName).toBe('ada')
  })

  it('no profile, anywhere else: still sent to /profile/setup', async () => {
    requestHeaders = { 'x-user-id': 'u1', 'x-pathname': '/votes' }
    profileRows = []
    await expect(layoutElement()).rejects.toThrow('redirect /profile/setup?redirect=%2Fvotes')
  })
})

describe('one sign-out path', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = path.join(dir, name)
      return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
    })
  }

  it('no file under src but the helper names the sign-out route (the route itself aside)', () => {
    const naming = sources(path.join(REPO, 'src'))
      .filter((f) => readFileSync(f, 'utf8').includes('/api/auth/signout'))
      .map((f) => path.relative(REPO, f))
    expect(naming).toEqual(['src/lib/auth/client-sign-out.ts'])
  })

  it.each(['src/components/layout/sidebar.tsx', 'src/components/layout/app-shell.tsx'])(
    '%s takes its sign-out from the helper',
    (file) => {
      const src = readFileSync(path.join(REPO, file), 'utf8')
      expect(src).toContain("from '@/lib/auth/client-sign-out'")
      expect(src).toContain('useSignOut()')
    }
  )
})

// ---- the rest of the C3 threshold: login as paper, onboarding fit ---------------
//
// Kept in this file because it is C3's one test file. The login's behaviour
// (redirects, focus, errors) stays pinned by login-redirect.test.ts; these pin
// the paper card and the shared coarse-pointer check.

describe('the login card is paper', () => {
  async function renderLogin() {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query })))
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    await act(async () => {
      render(h(LoginPage))
    })
  }

  it('sits the form inside a light-scope paper, microcopy included', async () => {
    await renderLogin()
    const paper = screen.getByLabelText('Email address').closest('.light-scope') as HTMLElement | null
    expect(paper).not.toBeNull()
    expect(paper?.getAttribute('style')).toContain('var(--journey-paper)')
    expect(paper?.textContent).toContain('No password. No tracking. Just a code.')
    expect(paper?.querySelector('a[href="/privacy"]')).not.toBeNull()
  })

  it('uses tokens, never white/ or black/ opacity stacks', async () => {
    await renderLogin()
    const classes = Array.from(document.querySelectorAll('[class]')).map((el) => el.getAttribute('class') ?? '')
    expect(classes.length).toBeGreaterThan(10)
    expect(classes.filter((c) => /\b(?:text|bg|border|from|via|to|placeholder)-(?:white|black)\b/.test(c))).toEqual([])
    expect(classes.some((c) => c.includes('from-surface-0/80'))).toBe(true)
  })

  it('sets the photograph low, so the bright crevice is below the card', async () => {
    await renderLogin()
    const photo = document.querySelector('[style*="cave-login.jpg"]') as HTMLElement | null
    expect(photo?.style.backgroundPosition).toBe('center 35%')
  })

  it('scrims the brand block', async () => {
    await renderLogin()
    const heading = screen.getByRole('heading', { name: 'Open Cave' })
    const scrim = heading.parentElement?.querySelector('[aria-hidden="true"]') as HTMLElement | null
    expect(scrim?.getAttribute('style')).toContain('radial-gradient')
    expect(scrim?.getAttribute('style')).toContain('var(--surface-0)')
  })

  it('gives the tagline its period, as on the hero', async () => {
    await renderLogin()
    expect(screen.getByText('A Republic for the examined institution.')).toBeTruthy()
    const hero = readFileSync(path.join(REPO, 'src/components/landing/hero.tsx'), 'utf8')
    expect(hero).toContain('A Republic for the examined institution.')
  })

  it('reads the quiet links at text-muted (5.5:1 on paper), not white/30', async () => {
    await renderLogin()
    const email = screen.getByLabelText('Email address')
    fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, sent: true }) }))
    )
    await act(async () => {
      fireEvent.keyDown(email, { key: 'Enter' })
    })
    for (const name of ['Use a different email', 'Send a new code']) {
      const cls = screen.getByRole('button', { name }).getAttribute('class') ?? ''
      expect(cls).toContain('text-text-muted')
    }
  })

  it('shows an unavailable action recessed, not dimmed with opacity', async () => {
    await renderLogin()
    const send = screen.getByRole('button', { name: 'Send code' })
    expect(send.getAttribute('aria-disabled')).toBe('true')
    const cls = send.getAttribute('class') ?? ''
    expect(cls).not.toContain('opacity-40')
    // Not the empty field's fill or border (Jen C3 C3).
    expect(cls).toContain('bg-surface-3')
    expect(cls).toContain('border-transparent')
    expect(cls).toContain('text-text-secondary')
    expect(cls).not.toContain('bg-surface-1')
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.test' } })
    expect(send.getAttribute('class')).toContain('bg-text-primary')
  })

  it('takes its coarse-pointer check from the shared module', () => {
    const src = readFileSync(path.join(REPO, 'src/app/(auth)/login/page.tsx'), 'utf8')
    expect(src).toContain("import { hasCoarsePointer } from '@/lib/ui/input-modality'")
    expect(src).not.toContain('(pointer: coarse)')
    expect(src).not.toMatch(/function hasCoarsePointer/)
  })
})

describe('the onboarding page fits under the shell header', () => {
  it('fills the scroll area, never a whole extra screen', () => {
    const src = readFileSync(path.join(REPO, 'src/app/(app)/profile/setup/page.tsx'), 'utf8')
    expect(src).not.toMatch(/className="[^"]*min-h-screen/)
    expect(src.match(/className="[^"]*min-h-full/g)?.length).toBe(3)
  })
})

// ---- Fix pass: unsaved work survives a sign-out elsewhere (Razor C3 W2) ----

describe('a sign-out in another tab, with unsaved work here', () => {
  it('no unsaved work: the tab reloads', () => {
    mod.onSignedOutElsewhere()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('registered unsaved work: no reload, and the shell shows the notice', async () => {
    const { AppShell } = await loadShell()
    function Draft() {
      mod.useUnsavedWork(true)
      return h('textarea', { defaultValue: 'my unsaved letter', 'aria-label': 'draft' })
    }
    render(h(AppShell, { variant: 'app', displayName: 'ada', children: h(Draft) }))
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe(
      "You signed out in another tab, so this tab can't save. Sign in again in a new tab, then save here."
    )
    expect((screen.getByLabelText('draft') as HTMLTextAreaElement).value).toBe('my unsaved letter')
  })

  it('the onboarding shell shows the notice too', async () => {
    const { AppShell } = await loadShell()
    function Draft() {
      mod.useUnsavedWork(true)
      return null
    }
    render(h(AppShell, { variant: 'onboarding', children: h(Draft) }))
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain(mod.NOTICE_LEAD.elsewhere)
  })

  it('work that stops being dirty, or unmounts, no longer holds the reload', async () => {
    function Draft({ dirty }: { dirty: boolean }) {
      mod.useUnsavedWork(dirty)
      return null
    }
    const view = render(h(Draft, { dirty: true }))
    expect(mod.hasUnsavedWork()).toBe(true)
    view.rerender(h(Draft, { dirty: false }))
    expect(mod.hasUnsavedWork()).toBe(false)
    view.rerender(h(Draft, { dirty: true }))
    expect(mod.hasUnsavedWork()).toBe(true)
    view.unmount()
    expect(mod.hasUnsavedWork()).toBe(false)
    mod.onSignedOutElsewhere()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('the Lever editor registers an unsaved edit', () => {
  it('editing text that differs from the stored letter holds the reload; Cancel releases it', async () => {
    const realFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/signout') return realFetch(url, init)
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { ActionViewer } = await import('@/components/lever/action-viewer')
    render(h(ActionViewer, {
      actionId: '44444444-4444-4444-8444-444444444444',
      initialContent: 'Dear FOI Coordinator,\nI request the records.',
      initialStatus: 'draft',
      actionType: 'public_comment',
    } as unknown as Parameters<typeof ActionViewer>[0]))
    await click(screen.getByText('Edit'))
    // Open but unchanged: nothing to lose.
    expect(mod.hasUnsavedWork()).toBe(false)
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Dear FOI Coordinator,\nI request the records, and more.' } })
    expect(mod.hasUnsavedWork()).toBe(true)
    mod.onSignedOutElsewhere()
    expect(reload).not.toHaveBeenCalled()
    expect(box.value).toContain('and more.')
    await click(screen.getByText('Cancel'))
    expect(mod.hasUnsavedWork()).toBe(false)
  })
})

describe('the profile setup form registers typed text', () => {
  it('typing a name holds the reload', async () => {
    const { default: SetupPage } = await import('@/app/(app)/profile/setup/page')
    await act(async () => {
      render(h(SetupPage))
    })
    const name = await screen.findByLabelText('Display name')
    expect(mod.hasUnsavedWork()).toBe(false)
    fireEvent.change(name, { target: { value: 'ada' } })
    expect(mod.hasUnsavedWork()).toBe(true)
    mod.onSignedOutElsewhere()
    expect(reload).not.toHaveBeenCalled()
    fireEvent.change(name, { target: { value: '' } })
    expect(mod.hasUnsavedWork()).toBe(false)
  })
})

// ---- Fix pass: account deletion tells the other tabs (Razor C3 N2) ----

describe('account deletion broadcasts signed-out', () => {
  async function deleteFlow(reply: () => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/account') return reply()
      throw new Error(`unexpected fetch ${url}`)
    }))
    const { DeleteAccount } = await import('@/components/profile/delete-account')
    const tab2 = otherTab()
    render(h(DeleteAccount))
    await click(screen.getByRole('button', { name: 'Delete account' }))
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'DELETE' } })
    const buttons = screen.getAllByRole('button').filter((b) => /delete/i.test(b.textContent ?? ''))
    await click(buttons[buttons.length - 1])
    return tab2
  }

  it('after the server confirms', async () => {
    const tab2 = await deleteFlow(async () => new Response('{}', { status: 200 }))
    expect(tab2.heard).toEqual([{ type: 'signed-out' }])
    expect(routerPush).toHaveBeenCalledWith('/')
  })

  it('never when the deletion failed', async () => {
    const tab2 = await deleteFlow(async () => new Response('{}', { status: 500 }))
    expect(tab2.heard).toEqual([])
  })
})

// ---- Design fix pass (Jen C3 C1-C9) ------------------------------------------

describe('the signed-out notice: a control for every action it names (Jen C6)', () => {
  async function shellWithDraft(variant: 'app' | 'onboarding' = 'app') {
    const { AppShell } = await loadShell()
    function Draft() {
      mod.useUnsavedWork(true)
      return h('textarea', { defaultValue: 'kept', 'aria-label': 'draft' })
    }
    render(h(AppShell, { variant, displayName: 'ada', children: h(Draft) }))
  }

  it('links to /login for this page, in a new tab, and carries a warning mark', async () => {
    await shellWithDraft()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    const alert = screen.getByRole('alert')
    const link = screen.getByRole('link', { name: 'Sign in again in a new tab' })
    expect(alert.contains(link)).toBe(true)
    expect(link.getAttribute('href')).toBe('/login?redirect=%2Fprofile%2Fsetup')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener')
    expect(alert.querySelector('svg.lucide-circle-alert')?.getAttribute('class')).toContain('text-status-warning')
  })

  it('clears on a signed-in message from another tab (the hook C4 will send to)', async () => {
    await shellWithDraft()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    expect(screen.queryByRole('alert')).not.toBeNull()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-in', handoff: 'abc' })
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(reload).not.toHaveBeenCalled()
  })

  it('a signed-in message never reloads a clean tab', () => {
    const stop = mod.listenForSignOutElsewhere()
    new FakeChannel('oc-auth').postMessage({ type: 'signed-in' })
    expect(reload).not.toHaveBeenCalled()
    stop()
  })

  it('clears when a write from this tab succeeds', async () => {
    await shellWithDraft()
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    await act(async () => mod.clearSignedOutNotice())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("a 401 here raises the notice with its own lead, and doesn't replace one already showing", async () => {
    await shellWithDraft('onboarding')
    await act(async () => mod.noteSignedOutByServer())
    expect(screen.getByRole('alert').textContent).toBe(
      "You're signed out, so this tab can't save. Sign in again in a new tab, then save here."
    )
    await act(async () => mod.clearSignedOutNotice())
    await act(async () => {
      new FakeChannel('oc-auth').postMessage({ type: 'signed-out' })
    })
    await act(async () => mod.noteSignedOutByServer())
    expect(screen.getByRole('alert').textContent).toContain(mod.NOTICE_LEAD.elsewhere)
  })
})

describe('sign-out busy is visible (Jen C5)', () => {
  it.each(['sidebar', 'onboarding'] as const)('%s: a spinner replaces the icon and a status says "Signing out"', async (where) => {
    signOutReply = () => new Promise(() => {})
    const { AppShell, Sidebar } = await loadShell()
    render(where === 'sidebar' ? h(Sidebar, { displayName: 'ada' }) : h(AppShell, { variant: 'onboarding', children: h('p', null, 'x') }))
    const button = screen.getByRole('button', { name: /Sign out/ })
    expect(button.querySelector('svg.lucide-log-out')).not.toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    await click(button)
    expect(button.querySelector('svg.lucide-log-out')).toBeNull()
    expect(button.querySelector('svg.animate-spin')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Signing out')
    expect(button.textContent).toContain('Sign out')
  })

  it('the onboarding failure line starts at the gutter on phones, left-aligned', async () => {
    signOutReply = status(500)
    const { AppShell } = await loadShell()
    render(h(AppShell, { variant: 'onboarding', children: h('p', null, 'x') }))
    await click(screen.getByRole('button', { name: /Sign out/ }))
    const cls = screen.getByRole('alert').getAttribute('class') ?? ''
    for (const c of ['ml-auto', 'max-w-sm', 'text-left', 'flex', 'items-start']) expect(cls.split(' ')).toContain(c)
  })
})

describe('saving while signed out never shows "Unauthorized" (Jen C7)', () => {
  it('Lever Save: plain copy with the mark, text kept, notice raised; a later save clears it', async () => {
    let patchStatus = 401
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        if (patchStatus === 401) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        const body = JSON.parse(String(init.body))
        return new Response(JSON.stringify({ action: { content: body.content } }), { status: 200 })
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { AppShell } = await loadShell()
    const { ActionViewer } = await import('@/components/lever/action-viewer')
    render(h(AppShell, { variant: 'app', displayName: 'ada', children: h(ActionViewer, {
      actionId: '44444444-4444-4444-8444-444444444444',
      initialContent: 'Dear FOI Coordinator,\nI request the records.',
      initialStatus: 'draft',
      actionType: 'public_comment',
    } as unknown as Parameters<typeof ActionViewer>[0]) }))
    await click(screen.getByText('Edit'))
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'my new words' } })
    await click(screen.getByText('Save'))
    await waitForText("You're signed out, so this wasn't saved. Your text is still here.")
    expect(document.body.textContent).not.toContain('Unauthorized')
    const line = screen.getByText("You're signed out, so this wasn't saved. Your text is still here.")
    expect(line.querySelector('svg.lucide-circle-alert')).not.toBeNull()
    expect(box.value).toBe('my new words')
    expect(document.body.textContent).toContain(mod.NOTICE_LEAD.server)
    expect(screen.getByRole('link', { name: 'Sign in again in a new tab' })).toBeTruthy()
    patchStatus = 200
    await click(screen.getByText('Save'))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(document.body.textContent).not.toContain(mod.NOTICE_LEAD.server)
  })

  it('any other Lever write answered 401 (Mark as Final) shows no server string and raises the notice', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { AppShell } = await loadShell()
    const { ActionViewer } = await import('@/components/lever/action-viewer')
    render(h(AppShell, { variant: 'app', displayName: 'ada', children: h(ActionViewer, {
      actionId: '44444444-4444-4444-8444-444444444444',
      initialContent: 'Dear Council,\nI object.',
      initialStatus: 'draft',
      actionType: 'public_comment',
    } as unknown as Parameters<typeof ActionViewer>[0]) }))
    await click(screen.getByText('Mark as Final'))
    await waitForText(mod.NOTICE_LEAD.server)
    expect(document.body.textContent).not.toContain('Unauthorized')
  })

  it('Lever Re-generate answered 401: plain copy, the letter kept, notice raised (Razor DN1)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/lever/generate') return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
    const { AppShell } = await loadShell()
    const { ActionViewer } = await import('@/components/lever/action-viewer')
    render(h(AppShell, { variant: 'app', displayName: 'ada', children: h(ActionViewer, {
      actionId: '44444444-4444-4444-8444-444444444444',
      initialContent: 'Dear Council,\nI object to the rezoning.',
      initialStatus: 'draft',
      actionType: 'public_comment',
    } as unknown as Parameters<typeof ActionViewer>[0]) }))
    await click(screen.getByText('Re-generate'))
    await waitForText("You're signed out, so the letter wasn't regenerated. Your text is still here.")
    expect(document.body.textContent).not.toContain('Unauthorized')
    expect(document.body.textContent).toContain('I object to the rezoning.')
    expect(document.body.textContent).toContain(mod.NOTICE_LEAD.server)
  })

  it('setup Claim: plain copy with the mark, text kept, notice raised', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/profile' && init?.method === 'POST') return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      return new Response(JSON.stringify({ profile: null }), { status: 200 })
    }))
    const { AppShell } = await loadShell()
    const { default: SetupPage } = await import('@/app/(app)/profile/setup/page')
    await act(async () => {
      render(h(AppShell, { variant: 'onboarding', children: h(SetupPage) }))
    })
    const name = (await screen.findByLabelText('Display name')) as HTMLInputElement
    fireEvent.change(name, { target: { value: 'ada_lovelace' } })
    await click(screen.getByRole('button', { name: 'Claim your name' }))
    await waitForText("You're signed out, so your name wasn't saved. What you typed is still here.")
    expect(document.body.textContent).not.toContain('Unauthorized')
    const line = screen.getByText("You're signed out, so your name wasn't saved. What you typed is still here.")
    expect(line.querySelector('svg.lucide-circle-alert')).not.toBeNull()
    expect(name.value).toBe('ada_lovelace')
    expect(document.body.textContent).toContain(mod.NOTICE_LEAD.server)
    expect(assign).not.toHaveBeenCalled()
  })
})

async function waitForText(text: string) {
  for (let i = 0; i < 50 && !document.body.textContent?.includes(text); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
  expect(document.body.textContent).toContain(text)
}

describe('the onboarding page says where the citizen is (Jen C8, P1-6)', () => {
  async function renderSetup(coarse: boolean, profile: unknown = null) {
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: coarse && q === '(pointer: coarse)', media: q })))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ profile }), { status: 200 })))
    const { default: SetupPage } = await import('@/app/(app)/profile/setup/page')
    await act(async () => {
      render(h(SetupPage))
    })
    return (await screen.findByLabelText('Display name')) as HTMLInputElement
  }

  it('first run: "Welcome to Open Cave" in Fraunces, and the one-step line', async () => {
    await renderSetup(false)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Welcome to Open Cave')
    for (const c of ['font-display', 'text-2xl', 'font-semibold', 'tracking-[-0.01em]']) expect(h1.className.split(' ')).toContain(c)
    const line = screen.getByText('One step before you start: choose the name other citizens will see. Your email stays private.')
    expect(line.className).toContain('text-pretty')
  })

  it('edit mode keeps "Edit Profile", in the same heading style', async () => {
    await renderSetup(false, { displayName: 'ada', bio: '' })
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Edit Profile')
    expect(h1.className.split(' ')).toContain('font-display')
  })

  it('fine pointer: the name field is focused on load', async () => {
    const name = await renderSetup(false)
    expect(document.activeElement).toBe(name)
  })

  it('touch screen: nothing is focused on load', async () => {
    const name = await renderSetup(true)
    expect(document.activeElement).not.toBe(name)
    expect(name.hasAttribute('autofocus')).toBe(false)
  })
})

describe('the login card: errors, the unavailable recipe, touch sizes (Jen C1, C4, C9)', () => {
  async function renderLoginWith(responses: { send?: [number, unknown]; verify?: [number, unknown] }) {
    vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: false, media: q })))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const [st, body] = url.endsWith('send-code') ? (responses.send ?? [200, { ok: true, sent: true }]) : (responses.verify ?? [200, {}])
      return { ok: st < 400, status: st, json: async () => body }
    }))
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    await act(async () => {
      render(h(LoginPage))
    })
    return screen.getByLabelText('Email address') as HTMLInputElement
  }
  async function enter(el: HTMLElement) {
    await act(async () => {
      fireEvent.keyDown(el, { key: 'Enter' })
    })
  }

  it('a wrong code marks the code field invalid, described by the error, which carries the mark', async () => {
    const email = await renderLoginWith({ verify: [401, { error: 'invalid' }] })
    fireEvent.change(email, { target: { value: 'a@b.test' } })
    await enter(email)
    const code = screen.getByLabelText('8-digit code') as HTMLInputElement
    expect(code.getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(code, { target: { value: '12345678' } })
    await enter(code)
    const alert = screen.getByRole('alert')
    expect(alert.id).toBe('login-error')
    expect(alert.querySelector('svg.lucide-circle-alert')).not.toBeNull()
    expect(code.getAttribute('aria-invalid')).toBe('true')
    expect(code.getAttribute('aria-describedby')).toBe('login-error')
    expect(code.className).toContain('aria-invalid:border-status-danger')
  })

  it('a send 400 marks the email field; a 500 marks nothing', async () => {
    const email = await renderLoginWith({ send: [400, { error: 'bad' }] })
    fireEvent.change(email, { target: { value: 'nope' } })
    await enter(email)
    expect(email.getAttribute('aria-invalid')).toBe('true')
    expect(email.className).toContain('aria-invalid:border-status-danger')
    cleanup()
    const email2 = await renderLoginWith({ send: [500, {}] })
    fireEvent.change(email2, { target: { value: 'a@b.test' } })
    await enter(email2)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(email2.getAttribute('aria-invalid')).toBeNull()
  })

  it('a verify 429 or 500 marks nothing: it is not about the code', async () => {
    for (const verify of [[429, {}], [500, {}]] as Array<[number, unknown]>) {
      const email = await renderLoginWith({ verify })
      fireEvent.change(email, { target: { value: 'a@b.test' } })
      await enter(email)
      const code = screen.getByLabelText('8-digit code') as HTMLInputElement
      fireEvent.change(code, { target: { value: '12345678' } })
      await enter(code)
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(code.getAttribute('aria-invalid')).toBeNull()
      cleanup()
    }
  })

  it('the next attempt clears the mark', async () => {
    const email = await renderLoginWith({ send: [400, { error: 'bad' }] })
    fireEvent.change(email, { target: { value: 'nope' } })
    await enter(email)
    expect(email.getAttribute('aria-invalid')).toBe('true')
    vi.stubGlobal('fetch', vi.fn(async () => new Promise(() => {})))
    await enter(email)
    expect(email.getAttribute('aria-invalid')).toBeNull()
  })

  it('the code-step text buttons are 24px, and 44px on touch', async () => {
    const email = await renderLoginWith({})
    fireEvent.change(email, { target: { value: 'a@b.test' } })
    await enter(email)
    for (const name of ['Send a new code', 'Use a different email']) {
      const cls = (screen.getByRole('button', { name }).getAttribute('class') ?? '').split(' ')
      expect(cls).toContain('min-h-6')
      expect(cls).toContain('pointer-coarse:min-h-11')
    }
  })

  it('main clips the scrim, safe-centres and pads (layout measured on the harness)', async () => {
    await renderLoginWith({})
    const cls = (document.querySelector('main')?.getAttribute('class') ?? '').split(' ')
    for (const c of ['overflow-x-clip', 'justify-center-safe', 'pt-16', 'pb-8']) expect(cls).toContain(c)
    // The plain centre is there too, for Safari before 17.6, where `safe
    // center` is dropped (Razor DN2); the compiled order is checked on the harness.
    expect(cls).toContain('justify-center')
  })
})
