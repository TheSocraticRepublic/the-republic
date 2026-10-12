// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { render, cleanup, fireEvent, act, within } from '@testing-library/react'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { TextEncoder as NodeTextEncoder } from 'node:util'
import { NextRequest } from 'next/server'

/*
 * B2: the shell, the wordmark (R6) and the Forum's presentation while gated
 * (R9). The Forum layout is a server component, rendered here by calling it
 * the way Next does (props in, element out) and mounting what it returns.
 * The sidebar and shell are client components, mounted in jsdom with the two
 * Next hooks they read replaced. Nothing here touches the gate: FORUM_ENABLED
 * is read through the real isForumEnabled().
 */

let pathname = '/investigate'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  // The gated layout must never reach for notFound() any more (R9).
  notFound: () => {
    throw new Error('notFound() called')
  },
}))

let cookieToken: string | undefined
let cookieReads = 0
let requestHeaders: Record<string, string> = {}
vi.mock('next/headers', () => ({
  headers: async () => new Headers(requestHeaders),
  cookies: async () => (cookieReads++, {
    get: (name: string) => (name === 'republic_token' && cookieToken ? { name, value: cookieToken } : undefined),
  }),
}))

// Under the jsdom environment the global Uint8Array is jsdom's, while
// TextEncoder (Node's) returns Node's, so jose's `instanceof Uint8Array`
// check rejects every payload. jose builds its encoder when first imported.
// Install an encoder that returns the global realm's Uint8Array before
// anything imports jose: tokens are then signed and verified by the real
// jwt.ts, exactly as the middleware does it.
class RealmTextEncoder extends NodeTextEncoder {
  encode(input?: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(super.encode(input)) as Uint8Array<ArrayBuffer>
  }
}
globalThis.TextEncoder = RealmTextEncoder as unknown as typeof TextEncoder

// The (app) layout's two lookups: the profile row and the credential weight.
let profileLookup: () => Promise<{ displayName: string }[]> = async () => [{ displayName: 'Ada Citizen' }]
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => profileLookup() }) }) }),
  }),
}))
vi.mock('@/lib/credentials/check-moderator', () => ({
  checkModeratorAccess: async () => ({ effectiveWeight: 0 }),
}))

const { default: ForumLayout } = await import('@/app/(app)/forum/layout')
const { default: AppLayout } = await import('@/app/(app)/layout')
const { isForumEnabled } = await import('@/lib/forum/flag')
const { Sidebar } = await import('@/components/layout/sidebar')
const { AppShell } = await import('@/components/layout/app-shell')
const { default: PublicLayout } = await import('@/app/(public)/layout')
const { default: NotFound } = await import('@/app/not-found')
const { default: AppNotFound } = await import('@/app/(app)/not-found')
const { default: PublicNotFound } = await import('@/app/(public)/not-found')
const { signJWT } = await import('@/lib/auth/jwt')

const HONEST = 'The Forum opens later. Nothing here yet.'
const CHILD = 'FORUM PAGE BODY'

function forumChild() {
  return h('p', { 'data-testid': 'forum-child' }, CHILD)
}

const scrollIntoView = vi.fn()

beforeEach(() => {
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  cleanup()
  requestHeaders = {}
  profileLookup = async () => [{ displayName: 'Ada Citizen' }]
  delete process.env.FORUM_ENABLED
  pathname = '/investigate'
  cookieToken = undefined
})

// ---------------------------------------------------------------------------
// R9: the Forum layout, gated and open
// ---------------------------------------------------------------------------

describe('Forum layout while the gate is off (R9)', () => {
  it('renders the honest "opens later" page and never the Forum page itself', () => {
    delete process.env.FORUM_ENABLED
    const { container } = render(ForumLayout({ children: forumChild() }) as React.ReactElement)
    expect(container.textContent).toContain(HONEST)
    expect(container.querySelector('h1')?.textContent).toBe('Forum')
    expect(container.querySelector('[data-testid="forum-child"]')).toBeNull()
    // Jen C6: one working way onward, into the app.
    const onward = within(container).getByRole('link', { name: 'Start an investigation' })
    expect(onward.getAttribute('href')).toBe('/investigate')
    expect(container.textContent).not.toContain(CHILD)
  })

  it('is fail-closed: any value but the literal "true" keeps the honest page', () => {
    for (const v of ['1', 'yes', 'TRUE', '']) {
      process.env.FORUM_ENABLED = v
      const { container, unmount } = render(ForumLayout({ children: forumChild() }) as React.ReactElement)
      expect(container.textContent).toContain(HONEST)
      expect(container.querySelector('[data-testid="forum-child"]')).toBeNull()
      unmount()
    }
  })

  it('says nothing untrue: no "not found" wording on the gated page', () => {
    delete process.env.FORUM_ENABLED
    const { container } = render(ForumLayout({ children: forumChild() }) as React.ReactElement)
    expect(container.textContent).toContain('opens later')
    expect(container.textContent?.toLowerCase()).not.toContain('not found')
  })
})

describe('Forum layout with the gate on', () => {
  it('renders the Forum page and not the honest page', () => {
    process.env.FORUM_ENABLED = 'true'
    const { container } = render(h('div', null, ForumLayout({ children: forumChild() })))
    expect(container.querySelector('[data-testid="forum-child"]')?.textContent).toBe(CHILD)
    expect(container.textContent).not.toContain(HONEST)
  })
})

describe('isForumEnabled is unchanged', () => {
  it('is true only for the literal string "true"', () => {
    delete process.env.FORUM_ENABLED
    expect(isForumEnabled()).toBe(false)
    for (const v of ['1', 'yes', 'TRUE', 'True', '', ' true']) {
      process.env.FORUM_ENABLED = v
      expect(isForumEnabled()).toBe(false)
    }
    process.env.FORUM_ENABLED = 'true'
    expect(isForumEnabled()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// /api/forum/* stays 404 while gated: every handler in every route file
// ---------------------------------------------------------------------------

const API_ROOT = path.resolve(__dirname, '../../src/app/api/forum')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return routeFiles(full)
    return name === 'route.ts' ? [full] : []
  })
}

describe('GET /api/forum/* (and every other method) stays 404 while gated', () => {
  it('denies every exported handler', async () => {
    delete process.env.FORUM_ENABLED
    const files = routeFiles(API_ROOT)
    expect(files.length).toBeGreaterThanOrEqual(7)
    let gets = 0
    for (const file of files) {
      const rel = path.relative(API_ROOT, path.dirname(file))
      const params = Object.fromEntries(
        [...rel.matchAll(/\[(\w+)\]/g)].map((m) => [m[1], 'x']),
      )
      const mod = (await import(file)) as Record<string, unknown>
      for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
        const handler = mod[method] as
          | ((req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>)
          | undefined
        if (typeof handler !== 'function') continue
        if (method === 'GET') gets++
        const res = await handler(
          new NextRequest(`http://localhost/api/forum/${rel}`, { method }),
          { params: Promise.resolve(params) },
        )
        expect(res.status, `${method} /api/forum/${rel}`).toBe(404)
      }
    }
    expect(gets).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// The sidebar
// ---------------------------------------------------------------------------

function mountSidebar(props: Record<string, unknown> = {}) {
  return render(h(Sidebar, { displayName: 'Ada Citizen', ...props }))
}

describe('Sidebar wordmark (R6)', () => {
  it('is set in Fraunces with no tagline', () => {
    const { container } = mountSidebar()
    const mark = within(container).getByText('Open Cave')
    expect(mark.className).toContain('font-display')
    expect(mark.closest('a')?.getAttribute('href')).toBe('/')
    expect(container.textContent).toContain('Open Cave')
    expect(container.textContent?.toLowerCase()).not.toContain('civic ai')
  })
})

describe('Sidebar Forum row (R9)', () => {
  it('stays visible at readable contrast, says "Coming soon", and is not a link', () => {
    const { container } = mountSidebar()
    const row = container.querySelector<HTMLElement>('[data-nav="forum"]')!
    expect(row).not.toBeNull()
    expect(row.textContent).toContain('Forum')
    expect(row.textContent).toContain('Coming soon')
    expect(row.tagName).toBe('SPAN')
    expect(row.className).toContain('cursor-not-allowed')
    expect(row.className).not.toMatch(/opacity-/)
    expect(container.querySelector('a[href^="/forum"]')).toBeNull()
  })
})

describe('Sidebar identity (P2-16, P1-1 step 3)', () => {
  it('links the display name to /profile, with no separate Profile row', () => {
    const { container } = mountSidebar()
    const profileLinks = container.querySelectorAll('a[href="/profile"]')
    expect(profileLinks.length).toBe(1)
    expect(profileLinks[0].textContent).toContain('Ada Citizen')
    // Jen C5: the destination is in the accessible name; a long name truncates
    // at the size of "Sign out" instead of painting out of the sidebar.
    expect(profileLinks[0].getAttribute('aria-label')).toBe('Your profile, Ada Citizen')
    expect(profileLinks[0].className).toContain('min-w-0')
    const name = within(profileLinks[0] as HTMLElement).getByText('Ada Citizen')
    for (const c of ['truncate', 'min-w-0', 'text-sm']) expect(name.className, c).toContain(c)
    expect(name.parentElement!.className).toContain('min-w-0')
    expect(container.textContent).not.toContain('Your identity')
  })

  it('still offers the way to /profile when there is no display name', () => {
    const { container } = mountSidebar({ displayName: undefined })
    const link = container.querySelector('a[href="/profile"]')
    expect(link?.textContent).toBe('Your profile')
  })

  it('never sends the email to the client: the (app) layout does not hand it to the shell (Razor N1)', async () => {
    requestHeaders = { 'x-user-id': 'user-a', 'x-user-email': 'ada@example.test', 'x-pathname': '/votes' }
    const el = (await AppLayout({ children: h('p', null, 'page') })) as React.ReactElement<Record<string, unknown>>
    expect(el.type).toBe(AppShell)
    expect(el.props.displayName).toBe('Ada Citizen')
    expect(JSON.stringify(Object.keys(el.props))).not.toContain('Email')
    render(el)
    expect(document.body.textContent).toContain('Ada Citizen')
    expect(document.body.textContent).not.toContain('ada@example.test')
  })

  it('invents no name when the profile lookup fails: the footer says "Your profile" (Razor N2)', async () => {
    requestHeaders = { 'x-user-id': 'user-a', 'x-user-email': 'ada@example.test', 'x-pathname': '/votes' }
    profileLookup = async () => {
      throw new Error('db down')
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const el = (await AppLayout({ children: h('p', null, 'page') })) as React.ReactElement<Record<string, unknown>>
      expect(el.props.displayName).toBeUndefined()
      render(el)
      const link = document.querySelector('a[href="/profile"]')
      expect(link?.textContent).toBe('Your profile')
      expect(document.body.textContent).not.toContain('Dev User')
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('Sidebar rows', () => {
  it('tints the Vote Tracker icon at rest (Q2-a)', () => {
    pathname = '/investigate'
    const { container } = mountSidebar()
    const votes = container.querySelector('a[href="/votes"]')!
    expect(votes.getAttribute('aria-current')).toBeNull()
    const icon = votes.querySelector('svg')!
    expect(icon.getAttribute('style') ?? '').toContain('--accent-votes')
  })

  it('puts the active dot out of flow, so the row never reflows (P1-1 step 1)', () => {
    pathname = '/lever'
    const { container } = mountSidebar()
    const lever = container.querySelector('a[href="/lever"]')!
    expect(lever.getAttribute('aria-current')).toBe('page')
    expect(lever.className).toContain('relative')
    const dot = lever.querySelector('span[aria-hidden="true"].rounded-full')!
    expect(dot).not.toBeNull()
    expect(dot.className).toContain('absolute')
    expect(dot.className).not.toContain('ml-auto')
    // Two-line arm descriptions no longer collide (leading-none was the cause).
    const description = within(lever as HTMLElement).getByText('Draft a filing')
    expect(description.className).toContain('leading-tight')
    expect(description.className).not.toContain('leading-none')
  })

  it('pads the top of the row scroller so the first focus ring is not clipped (P2-10)', () => {
    const { container } = mountSidebar({ variant: 'sidebar' })
    const scroller = container.querySelector('nav .overflow-y-auto')!
    expect(scroller.className.split(/\s+/)).toContain('pt-1')
  })

  it('hides the Instruments list on collapse instead of unmounting it (P2-7)', () => {
    const { container } = mountSidebar()
    const toggle = within(container).getByRole('button', { name: /The Instruments/ })
    expect(toggle.getAttribute('aria-controls')).toBe('instruments-list')
    const list = () => container.querySelector('#instruments-list')
    expect(list()?.hasAttribute('hidden')).toBe(false)
    expect(list()?.querySelectorAll('li').length).toBe(5)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(list()).not.toBeNull()
    expect(list()?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(list()?.hasAttribute('hidden')).toBe(false)
  })

  // jsdom has no layout: give the scroller and the current row boxes.
  function boxes(scrollerBox: { top: number; bottom: number }, rowBox: { top: number; bottom: number }) {
    const orig = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.getAttribute('aria-current') === 'page') return { ...rowBox, left: 0, right: 0, width: 0, height: rowBox.bottom - rowBox.top, x: 0, y: rowBox.top, toJSON() {} } as DOMRect
      if (this.classList.contains('overflow-y-auto')) return { ...scrollerBox, left: 0, right: 0, width: 0, height: scrollerBox.bottom - scrollerBox.top, x: 0, y: scrollerBox.top, toJSON() {} } as DOMRect
      return orig.call(this)
    }
    return () => { Element.prototype.getBoundingClientRect = orig }
  }

  it('keeps the current row in view with scrollTop, never scrollIntoView (Jen C1: Tab start point)', () => {
    pathname = '/mirror'
    // Row below the scroller's bottom edge: scroll down by exactly the overhang.
    const restore = boxes({ top: 90, bottom: 600 }, { top: 640, bottom: 683 })
    try {
      const { container } = mountSidebar({ variant: 'sidebar' })
      const scroller = container.querySelector<HTMLElement>('nav .overflow-y-auto')!
      expect(scroller.scrollTop).toBe(83)
      // scrollIntoView moves Chromium's sequential-focus start point, so the
      // first Tab would skip "Skip to content". It must never be used here.
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('scrolls up to a row above the scroller, and leaves a visible row alone', () => {
    pathname = '/scout'
    const restore = boxes({ top: 90, bottom: 600 }, { top: 60, bottom: 103 })
    try {
      const { container, unmount } = mountSidebar({ variant: 'sidebar' })
      const scroller = container.querySelector<HTMLElement>('nav .overflow-y-auto')!
      // Row 30px above the scroller's top edge: scroll up by exactly that.
      // (jsdom does not clamp at 0, so the raw arithmetic shows.)
      expect(scroller.scrollTop).toBe(-30)
      unmount()
    } finally {
      restore()
    }
    const restore2 = boxes({ top: 90, bottom: 600 }, { top: 200, bottom: 243 })
    try {
      const { container } = mountSidebar({ variant: 'sidebar' })
      const scroller = container.querySelector<HTMLElement>('nav .overflow-y-auto')!
      expect(scroller.scrollTop).toBe(0)
      expect(scrollIntoView).not.toHaveBeenCalled()
    } finally {
      restore2()
    }
  })

  it('re-runs on route change', () => {
    pathname = '/investigate'
    const restore = boxes({ top: 90, bottom: 600 }, { top: 640, bottom: 650 })
    try {
      const { container, rerender } = mountSidebar({ variant: 'sidebar' })
      const scroller = container.querySelector<HTMLElement>('nav .overflow-y-auto')!
      expect(scroller.scrollTop).toBe(50)
      pathname = '/foundations'
      rerender(h(Sidebar, { displayName: 'Ada Citizen', variant: 'sidebar' }))
      expect(scroller.scrollTop).toBe(100)
    } finally {
      restore()
    }
  })
})

describe('Arm descriptions (Jen C4)', () => {
  it('are the reviewed one-line copy, mapped to their arms', () => {
    const { container } = mountSidebar()
    const want: Record<string, string> = {
      '/scout': 'Find the documents',
      '/oracle': 'See who it serves',
      '/gadfly': 'Test your thinking',
      '/lever': 'Draft a filing',
      '/mirror': 'Compare other places',
    }
    for (const [href, text] of Object.entries(want)) {
      const row = container.querySelector(`#instruments-list a[href="${href}"]`)!
      expect(row.querySelector('.text-2xs')?.textContent, href).toBe(text)
    }
  })
})

describe('Drawer close band (Jen C3)', () => {
  it('the drawer wordmark is a sticky opaque band with room for the X; the X is 44px inside it', async () => {
    const { container } = render(h(AppShell, { displayName: 'Ada Citizen', children: h('p', null, 'page') }))
    await act(async () => {
      fireEvent.click(within(container.querySelector('header')!).getByRole('button', { name: 'Open navigation' }))
    })
    const dialog = document.querySelector('[role="dialog"]')!
    const band = dialog.querySelector<HTMLElement>('[data-nav="band"]')!
    for (const c of ['sticky', 'top-0', 'z-10', 'bg-surface-2', 'pr-14', 'py-4']) expect(band.className, c).toContain(c)
    const close = within(dialog as HTMLElement).getByRole('button', { name: 'Close navigation' })
    for (const c of ['h-11', 'w-11', 'top-2', 'right-2', 'z-20']) expect(close.className, c).toContain(c)
    expect(dialog.querySelector('nav')!.className).toContain('scroll-pt-16')
  })

  it('the desktop sidebar wordmark is not sticky', () => {
    const { container } = mountSidebar({ variant: 'sidebar' })
    expect(container.querySelector('[data-nav="band"]')!.className).not.toContain('sticky')
  })
})

describe('Sidebar Beta card (P1-1 step 5, mobile P2-16)', () => {
  it('sits in the scroll region after Foundations, with 44px links', () => {
    const { container } = mountSidebar()
    const beta = container.querySelector<HTMLElement>('[data-nav="beta"]')!
    const foundations = container.querySelector('a[href="/foundations"]')!
    expect(beta).not.toBeNull()
    // Same scroll region as the nav rows, and after the last of them.
    expect(beta.parentElement).toBe(foundations.parentElement)
    expect(foundations.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const support = beta.querySelector('a[href^="https://ko-fi.com"]')!
    expect(support.className).toContain('min-h-11')
    const bug = within(beta).getByRole('button')
    expect(bug.parentElement?.className).toContain('[&>button]:min-h-11')
  })
})

describe('One scroller (mobile P1-2)', () => {
  it('drawer: the whole nav scrolls, with no nested scroller inside it', () => {
    const { container } = mountSidebar({ variant: 'drawer' })
    const nav = container.querySelector('nav')!
    expect(nav.className).toContain('overflow-y-auto')
    expect(nav.querySelectorAll('.overflow-y-auto').length).toBe(0)
    // The Beta card and the account block are inside that one scroller.
    expect(nav.contains(nav.querySelector('[data-nav="beta"]'))).toBe(true)
    expect(nav.querySelector('a[href="/profile"]')?.className).toContain('min-h-11')
  })

  it('sidebar: the nav rows scroll in one region; the nav itself does not', () => {
    const { container } = mountSidebar({ variant: 'sidebar' })
    const nav = container.querySelector('nav')!
    expect(nav.className).not.toContain('overflow-y-auto')
    const scrollers = nav.querySelectorAll('.overflow-y-auto')
    expect(scrollers.length).toBe(1)
    expect(scrollers[0].querySelector('a[href="/investigate"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

describe('AppShell', () => {
  it('has a <header> whose 44px menu button is the dialog trigger', async () => {
    const { container } = render(h(AppShell, { displayName: 'Ada Citizen', children: h('p', null, 'page') }))
    const header = container.querySelector('header')!
    expect(header).not.toBeNull()
    const trigger = within(header).getByRole('button', { name: 'Open navigation' })
    expect(trigger.className).toContain('h-11')
    expect(trigger.className).toContain('w-11')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    const mark = within(header).getByText('Open Cave')
    expect(mark.className).toContain('font-display')

    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.querySelector('nav')?.className).toContain('overflow-y-auto')
    // The dead animation classes are gone from the open drawer and overlay.
    expect(document.body.innerHTML).toContain('w-72')
    expect(document.body.innerHTML).not.toMatch(/animate-in|slide-in-from-left|animate-out/)
  })

  it('is h-dvh, not h-screen (mobile P2-13)', () => {
    const { container } = render(h(AppShell, { children: h('p', null, 'page') }))
    const root = container.firstElementChild!
    expect(root.className).toContain('h-dvh')
    expect(root.className).not.toContain('h-screen')
  })
})

describe('Public layout wordmark (R6)', () => {
  it('is set in Fraunces', () => {
    const { container } = render(PublicLayout({ children: h('p', null, 'page') }))
    const mark = within(container.querySelector('header')!).getByText('Open Cave')
    expect(mark.getAttribute('href')).toBe('/')
    expect(mark.className).toContain('font-display')
  })
})

// ---------------------------------------------------------------------------
// not-found (mobile P2-2, landing L13)
// ---------------------------------------------------------------------------

describe('not-found', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'forum-presentation-test-secret-0123456789'
  })
  afterEach(() => {
    delete process.env.JWT_SECRET
  })

  // The card is an async server component; resolve async elements before
  // handing the tree to React (testing-library cannot render them).
  async function resolve(node: unknown): Promise<unknown> {
    if (Array.isArray(node)) return Promise.all(node.map(resolve))
    if (!node || typeof node !== 'object' || !('type' in node)) return node
    const el = node as React.ReactElement<Record<string, unknown>>
    if (typeof el.type === 'function' && el.type.constructor.name === 'AsyncFunction') {
      return resolve(await (el.type as (p: unknown) => Promise<unknown>)(el.props))
    }
    const children = el.props.children
    if (children === undefined) return el
    return { ...el, props: { ...el.props, children: await resolve(children) } }
  }

  async function mount(component: () => unknown) {
    return render((await resolve(component())) as React.ReactElement)
  }
  const mountNotFound = () => mount(NotFound)

  it('top level: its own wordmark and exactly one <main>, holding the card', async () => {
    const { container } = await mountNotFound()
    const mains = container.querySelectorAll('main')
    expect(mains.length).toBe(1)
    expect(mains[0].querySelector('h1')?.textContent).toBe('Page not found')
    const marks = within(container).getAllByText('Open Cave')
    expect(marks.length).toBe(1)
    expect(marks[0].className).toContain('min-h-11')
  })

  it('app group: the card only, no wordmark and no <main> (the shell has both; Jen C2)', async () => {
    cookieToken = await signJWT({ sub: 'user-a', email: 'a@example.test' })
    const { container } = await mount(AppNotFound)
    expect(container.querySelector('[data-not-found-card]')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Page not found')
    expect(container.querySelectorAll('main').length).toBe(0)
    expect(container.textContent).not.toContain('Open Cave')
    expect(container.innerHTML).not.toContain('min-h-dvh')
    const action = container.querySelector('a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/investigations')
  })

  it('app group follows the real session: a signed-out visitor to an unknown /u/<name> goes home (Razor DN2)', async () => {
    cookieToken = undefined
    const { container } = await mount(AppNotFound)
    const action = container.querySelector('a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/')
    expect(action.textContent).toBe('Go to the home page')
  })

  it('app group inside the real shell: one <main> in all', async () => {
    const card = await resolve(AppNotFound())
    const { container } = render(h(AppShell, { displayName: 'Ada Citizen', children: card as React.ReactElement }))
    expect(container.querySelectorAll('main').length).toBe(1)
    expect(container.querySelector('main [data-not-found-card]')).not.toBeNull()
  })

  it('public group: the card only, always home, and it never reads the session (Jen C2, Razor DN1)', async () => {
    // A valid session is present, and is ignored: a cookie read under the
    // statically generated public routes dropped the 404's server render.
    cookieToken = await signJWT({ sub: 'user-a', email: 'a@example.test' })
    cookieReads = 0
    const { container } = await mount(PublicNotFound)
    expect(container.querySelector('[data-not-found-card]')).not.toBeNull()
    expect(container.querySelectorAll('main').length).toBe(0)
    expect(container.textContent).not.toContain('Open Cave')
    const action = container.querySelector('a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/')
    expect(action.textContent).toBe('Go to the home page')
    expect(cookieReads).toBe(0)
  })

  it('public group inside the real public layout: one <main>, one wordmark', async () => {
    const card = await resolve(PublicNotFound())
    const { container } = render(PublicLayout({ children: card as React.ReactElement }))
    expect(container.querySelectorAll('main').length).toBe(1)
    expect(within(container).getAllByText('Open Cave').length).toBe(1)
  })

  it('sends a signed-in citizen to their investigations', async () => {
    cookieToken = await signJWT({ sub: 'user-a', email: 'a@example.test' })
    const { container } = await mountNotFound()
    const action = container.querySelector('main a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/investigations')
    expect(action.textContent).toBe('Go to your investigations')
  })

  it('sends a signed-out visitor to the home page', async () => {
    cookieToken = undefined
    const { container } = await mountNotFound()
    const action = container.querySelector('main a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/')
    expect(action.textContent).toBe('Go to the home page')
  })

  it('treats a token that does not verify as signed out', async () => {
    process.env.JWT_SECRET = 'some-other-secret-entirely-0123456789'
    cookieToken = await signJWT({ sub: 'user-a', email: 'a@example.test' })
    process.env.JWT_SECRET = 'forum-presentation-test-secret-0123456789'
    const { container } = await mountNotFound()
    const action = container.querySelector('main a[data-not-found-action]')!
    expect(action.getAttribute('href')).toBe('/')
  })
})
