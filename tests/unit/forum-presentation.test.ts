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
vi.mock('next/headers', () => ({
  cookies: async () => ({
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

const { default: ForumLayout } = await import('@/app/(app)/forum/layout')
const { isForumEnabled } = await import('@/lib/forum/flag')
const { Sidebar } = await import('@/components/layout/sidebar')
const { AppShell } = await import('@/components/layout/app-shell')
const { default: PublicLayout } = await import('@/app/(public)/layout')
const { default: NotFound } = await import('@/app/not-found')
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
    expect(container.textContent).not.toContain('Your identity')
  })

  it('still offers the way to /profile when there is no display name', () => {
    const { container } = mountSidebar({ displayName: undefined })
    const link = container.querySelector('a[href="/profile"]')
    expect(link?.textContent).toBe('Your profile')
  })

  it('never shows the email, even when the shell is handed one', () => {
    render(h(AppShell, { userEmail: 'ada@example.test', displayName: 'Ada Citizen', children: h('p', null, 'page') }))
    expect(document.body.textContent).toContain('Ada Citizen')
    expect(document.body.textContent).not.toContain('ada@example.test')
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
    const description = within(lever as HTMLElement).getByText('Turn findings into filings')
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

  it('scrolls the current row into view on mount and on route change', () => {
    pathname = '/mirror'
    const { rerender } = mountSidebar()
    const call = scrollIntoView.mock.contexts.at(-1) as HTMLElement
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(call.getAttribute('href')).toBe('/mirror')

    pathname = '/foundations'
    rerender(h(Sidebar, { displayName: 'Ada Citizen' }))
    const next = scrollIntoView.mock.contexts.at(-1) as HTMLElement
    expect(next.getAttribute('href')).toBe('/foundations')
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

  async function mountNotFound() {
    return render(await NotFound())
  }

  it('wraps its content in <main>', async () => {
    const { container } = await mountNotFound()
    const main = container.querySelector('main')!
    expect(main).not.toBeNull()
    expect(main.querySelector('h1')?.textContent).toBe('Page not found')
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
