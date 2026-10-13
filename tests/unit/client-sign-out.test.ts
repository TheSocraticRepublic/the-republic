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

vi.mock('next/navigation', () => ({
  usePathname: () => '/profile/setup',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
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

const opaqueRedirect = async () => ({ type: 'opaqueredirect' as ResponseType, ok: false, status: 0 })
const status = (code: number) => async () => ({ type: 'basic' as ResponseType, ok: code < 400, status: code })

let mod: typeof import('@/lib/auth/client-sign-out')

beforeEach(async () => {
  FakeChannel.open = []
  FakeChannel.posted = []
  vi.stubGlobal('BroadcastChannel', FakeChannel)
  fetchCalls = []
  signOutReply = opaqueRedirect
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

  it('treats the route redirect (opaqueredirect) as success and goes to /login', async () => {
    const result = await mod.clientSignOut()
    expect(result).toEqual({ ok: true })
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('treats a 2xx as success too', async () => {
    signOutReply = status(200)
    expect(await mod.clientSignOut()).toEqual({ ok: true })
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })
})

describe('clientSignOut: the broadcast', () => {
  it("posts exactly {type:'signed-out'} on 'oc-auth', and another tab hears it", async () => {
    const tab2 = otherTab()
    await mod.clientSignOut()
    const fromHelper = FakeChannel.posted.filter((p) => p.name === 'oc-auth')
    expect(fromHelper).toHaveLength(1)
    // Exactly this object: no id, no email, no name, nothing else.
    expect(fromHelper[0].data).toStrictEqual({ type: 'signed-out' })
    expect(Object.keys(fromHelper[0].data as object)).toEqual(['type'])
    expect(tab2.heard).toEqual([{ type: 'signed-out' }])
  })

  it('broadcasts only after the request has answered', async () => {
    otherTab()
    await mod.clientSignOut()
    expect(fetchCalls[0].postedBefore).toBe(0)
    expect(FakeChannel.posted).toHaveLength(1)
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
    ['no network', async () => Promise.reject(new TypeError('Failed to fetch'))],
    ['403 (origin refused)', status(403)],
    ['429', status(429)],
    ['500', status(500)],
  ] as const)('%s: claims nothing, broadcasts nothing, stays put', async (_label, reply) => {
    signOutReply = reply as () => Promise<Partial<Response>>
    const tab2 = otherTab()
    const result = await mod.clientSignOut()
    expect(result).toEqual({ ok: false, message: mod.SIGN_OUT_FAILED_MESSAGE })
    expect(FakeChannel.posted).toHaveLength(0)
    expect(tab2.heard).toEqual([])
    expect(assign).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('has plain-instructional failure copy, no "Please"', () => {
    expect(mod.SIGN_OUT_FAILED_MESSAGE).toBe(
      "Open Cave couldn't sign you out. Check your connection, then try again."
    )
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
    expect(FakeChannel.posted).toHaveLength(1)
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
    expect(tab2.heard).toEqual([{ type: 'signed-out' }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('a failed sign-out shows the plain copy and stays', async () => {
    signOutReply = status(500)
    const { Sidebar } = await loadShell()
    render(h(Sidebar, { displayName: 'ada' }))
    const button = screen.getByRole('button', { name: 'Sign out' })
    await click(button)
    expect(screen.getByRole('alert').textContent).toBe(mod.SIGN_OUT_FAILED_MESSAGE)
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
    await act(async () => release({ type: 'opaqueredirect' as ResponseType, ok: false, status: 0 }))
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
    expect(tab2.heard).toEqual([{ type: 'signed-out' }])
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/login`)
  })

  it('a failed sign-out there shows the plain copy and keeps the form', async () => {
    signOutReply = async () => Promise.reject(new TypeError('Failed to fetch'))
    const { AppShell } = await loadShell()
    render(h(AppShell, { variant: 'onboarding', children: h('p', null, 'setup form') }))
    await click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('alert').textContent).toBe(mod.SIGN_OUT_FAILED_MESSAGE)
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
    expect(cls).toContain('bg-surface-1')
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
