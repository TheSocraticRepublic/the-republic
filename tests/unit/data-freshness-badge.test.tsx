// @vitest-environment jsdom
/**
 * UI plan E1: the Votes freshness badge, and the detail header it sits in.
 *
 * The badge fetches `/api/parliament/sync/status` on mount and dates the data
 * from `lastSync.completedAt`, or `lastSync.startedAt` when no sync has
 * completed. When that date is missing, or the request fails in any way, it
 * says "Sync time unknown" and never shows a guessed or computed age.
 *
 * Rendered with React DOM in jsdom; only `fetch` is stubbed, with the body the
 * status route (src/app/api/parliament/sync/status/route.ts) returns.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import postcss, { type Root } from 'postcss'
import tailwind from '@tailwindcss/postcss'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('notFound') },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-user-id': 'user-a' }),
}))
// next/link, reduced to the anchor it renders (jsdom has no app router).
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...rest }: { href: string; children?: import('react').ReactNode } & Record<string, unknown>) =>
      createElement('a', { href, ...rest }, children),
  }
})
// next/image, reduced to the img it renders (no image optimizer in jsdom).
vi.mock('next/image', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ src, alt, width, height, ...rest }: { src: string; alt: string; width?: number; height?: number } & Record<string, unknown>) =>
      createElement('img', { src, alt, width, height, ...rest }),
  }
})
/**
 * The database, as a Drizzle chain: every builder method returns the chain,
 * and awaiting it yields the next queued result set, in query order.
 */
const dbResults: unknown[][] = []
vi.mock('@/lib/db', () => {
  const chain = (): unknown =>
    new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
            Promise.resolve(dbResults.shift() ?? []).then(ok, bad)
        }
        return () => chain()
      },
    })
  return { getDb: () => ({ select: () => chain() }) }
})

import { DataFreshnessBadge } from '@/components/votes/data-freshness-badge'
import { DetailHeader } from '@/components/layout/detail-header'
import { MpProfileCard } from '@/components/votes/mp-profile-card'
import AllMPsPage from '@/app/(app)/votes/mp/page'
import RecentVotesPage from '@/app/(app)/votes/recent/page'
import MpProfilePage from '@/app/(app)/votes/mp/[mpId]/page'
import VoteDetailPage from '@/app/(app)/votes/vote/[voteId]/page'
import BillDetailPage from '@/app/(app)/votes/bill/[billId]/page'
import PublicProfilePage from '@/app/(app)/u/[displayName]/page'
import ProfilePage from '@/app/(app)/profile/page'

const COUNTS = { totalMps: 338, totalVotes: 1200, totalBills: 90 }

function respondWith(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const res = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }
  const fetchMock = vi.fn(async () => res as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Midday UTC, so the en-CA local date is the same in every runner timezone. */
function daysAgo(days: number): string {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

/** Every text the failure and missing paths must never show. */
function expectNoAge(container: HTMLElement) {
  const text = container.textContent ?? ''
  expect(text).toContain('Sync time unknown')
  expect(text).not.toMatch(/Data as of/)
  expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  expect(text).not.toMatch(/\bdays?\b/i)
  expect(text).not.toMatch(/stale/i)
  expect(text).not.toMatch(/No data synced/)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  dbResults.length = 0
})

describe('DataFreshnessBadge', () => {
  it('reads the status route and shows "Data as of" the completed sync date', async () => {
    const completedAt = daysAgo(2)
    const fetchMock = respondWith({
      lastSync: { startedAt: daysAgo(3), completedAt, durationMs: 1000 },
      counts: COUNTS,
    })
    const { container } = render(<DataFreshnessBadge />)
    const text = await screen.findByText(`Data as of ${localDate(completedAt)}`)
    expect(text.textContent).toBe(`Data as of ${localDate(completedAt)}`)
    expect(fetchMock).toHaveBeenCalledWith('/api/parliament/sync/status')
    expect(container.textContent).toContain('338 MPs, 1200 votes')
    expect(container.textContent).not.toContain('(stale)')
  })

  it('falls back to startedAt when no sync has completed', async () => {
    const startedAt = daysAgo(1)
    respondWith({ lastSync: { startedAt, completedAt: null, durationMs: null }, counts: COUNTS })
    render(<DataFreshnessBadge />)
    await screen.findByText(`Data as of ${localDate(startedAt)}`)
  })

  it('keeps the stale marker on data older than seven days', async () => {
    const completedAt = daysAgo(10)
    respondWith({ lastSync: { startedAt: completedAt, completedAt, durationMs: 1 }, counts: COUNTS })
    render(<DataFreshnessBadge />)
    await screen.findByText(`Data as of ${localDate(completedAt)} (stale)`)
  })

  it('the meta variant shows the date only, without counts, in 12px/400', async () => {
    const completedAt = daysAgo(2)
    respondWith({ lastSync: { startedAt: completedAt, completedAt, durationMs: 1 }, counts: COUNTS })
    const { container } = render(<DataFreshnessBadge variant="meta" />)
    await screen.findByText(`Data as of ${localDate(completedAt)}`)
    expect(container.textContent).toBe(`Data as of ${localDate(completedAt)}`)
    expect(container.textContent).not.toContain('338 MPs')
    const badge = container.querySelector('[data-freshness]')!
    expect(badge.className).toContain('text-xs font-normal')
  })

  it('the meta variant keeps the stale and unknown wordings', async () => {
    const completedAt = daysAgo(10)
    respondWith({ lastSync: { startedAt: completedAt, completedAt, durationMs: 1 }, counts: COUNTS })
    render(<DataFreshnessBadge variant="meta" />)
    await screen.findByText(`Data as of ${localDate(completedAt)} (stale)`)
    cleanup()
    respondWith({ lastSync: null, counts: COUNTS })
    const { container } = render(<DataFreshnessBadge variant="meta" />)
    await screen.findByText('Sync time unknown')
    expect(container.querySelector('[data-freshness]')!.className).toContain('text-xs font-normal')
  })

  it('the standalone badge (the /votes landing) keeps its 11px/500 type', async () => {
    const completedAt = daysAgo(2)
    respondWith({ lastSync: { startedAt: completedAt, completedAt, durationMs: 1 }, counts: COUNTS })
    const { container } = render(<DataFreshnessBadge />)
    await screen.findByText(`Data as of ${localDate(completedAt)}`)
    expect(container.querySelector('[data-freshness]')!.className).toContain('text-2xs font-medium')
  })

  it('shows a neutral loading state, not nothing, while the request is open', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { container } = render(<DataFreshnessBadge />)
    expect(container.textContent).toBe('Checking sync time')
    expect(container.querySelector('[data-freshness="loading"]')).not.toBeNull()
  })

  describe('missing: says "Sync time unknown"', () => {
    it('when no sync is on record (lastSync null)', async () => {
      respondWith({ lastSync: null, counts: { totalMps: 0, totalVotes: 0, totalBills: 0 } })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('when both dates are null', async () => {
      respondWith({ lastSync: { startedAt: null, completedAt: null, durationMs: null }, counts: COUNTS })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('when the date does not parse', async () => {
      respondWith({ lastSync: { startedAt: 'not a date', completedAt: null, durationMs: null }, counts: COUNTS })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })
  })

  describe('a failed newest sync: says "Sync time unknown", not its date', () => {
    it("errors and 0 upserts with completedAt set (the sync route's catch shape)", async () => {
      const at = daysAgo(1)
      respondWith({
        lastSync: { startedAt: at, completedAt: at, durationMs: 5, recordsUpserted: 0, errors: ['openparliament 503'] },
        counts: COUNTS,
      })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it("errors and null completedAt (the full-sync script's shape)", async () => {
      respondWith({
        lastSync: { startedAt: daysAgo(1), completedAt: null, durationMs: 5, recordsUpserted: 0, errors: [{ stage: 'votes', message: 'timeout' }] },
        counts: COUNTS,
      })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('errors and null upserts, errors as an object', async () => {
      const at = daysAgo(1)
      respondWith({
        lastSync: { startedAt: at, completedAt: at, durationMs: 5, recordsUpserted: null, errors: { fatal: 'boom' } },
        counts: COUNTS,
      })
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('errors with some upserts keeps its date (partial success)', async () => {
      const at = daysAgo(1)
      respondWith({
        lastSync: { startedAt: at, completedAt: at, durationMs: 5, recordsUpserted: 42, errors: ['one ballot failed'] },
        counts: COUNTS,
      })
      render(<DataFreshnessBadge />)
      await screen.findByText(`Data as of ${localDate(at)}`)
    })

    it('an empty errors array with 0 upserts is not a failure', async () => {
      const at = daysAgo(1)
      respondWith({
        lastSync: { startedAt: at, completedAt: at, durationMs: 5, recordsUpserted: 0, errors: [] },
        counts: COUNTS,
      })
      render(<DataFreshnessBadge />)
      await screen.findByText(`Data as of ${localDate(at)}`)
    })
  })

  describe('request failure: says "Sync time unknown", never a computed age', () => {
    it('when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down') }))
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('when the response is not OK', async () => {
      // The body carries a sync date, so ignoring the status would show one.
      respondWith(
        { lastSync: { startedAt: daysAgo(1), completedAt: daysAgo(1), durationMs: 1 }, counts: COUNTS },
        { ok: false, status: 503 },
      )
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('when the body is not JSON', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token <') },
      }) as unknown as Response))
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })
  })
})

describe('DetailHeader', () => {
  it('renders a real back link, a single h1, and the meta slot', () => {
    const { container } = render(
      <DetailHeader
        arm="votes"
        backHref="/votes/mp"
        backLabel="Back to MPs"
        title="Jane Doe"
        meta={<span data-testid="meta">Data as of 2026-11-01</span>}
      />
    )
    const back = screen.getByRole('link', { name: 'Back to MPs' })
    expect(back.getAttribute('href')).toBe('/votes/mp')
    expect(back.textContent).toBe('Back to MPs')
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('Jane Doe')
    // Jen E1 C4: a 50-character name with no break points (underscores) must
    // wrap at 320. jsdom has no layout, so this pins the class; the compiled
    // rule it maps to is checked in the CSS block below.
    expect(h1s[0].className.split(/\s+/)).toContain('break-words')
    const meta = container.querySelector('[data-detail-meta]')
    expect(meta).not.toBeNull()
    expect(meta!.contains(screen.getByTestId('meta'))).toBe(true)
    const bar = container.querySelector('[data-accent-bar]') as HTMLElement
    expect(bar.getAttribute('style')).toContain('--accent-votes')
  })

  it('omits the meta line when there is no meta', () => {
    const { container } = render(
      <DetailHeader backHref="/investigate" backLabel="Back to New Investigation" title="Profile" />
    )
    expect(container.querySelector('[data-detail-meta]')).toBeNull()
    expect(container.querySelector('h1')!.textContent).toBe('Profile')
    const bar = container.querySelector('[data-accent-bar]') as HTMLElement
    // Jen E1 C6: neutral, but not the rule's colour.
    expect(bar.getAttribute('style')).toContain('color-mix(in srgb, var(--text-faint) 60%, transparent)')
    expect(bar.getAttribute('style')).not.toContain('--border-strong')
  })
})

/*
 * The seven pages, rendered as Next calls them: the async server components
 * awaited, then mounted. The status route answers with a known sync; every
 * other fetch a child component makes stays open.
 */
describe('the detail pages carry DetailHeader, and Votes pages the badge', () => {
  const SYNCED = daysAgo(1)
  function stubNetwork() {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/parliament/sync/status') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ lastSync: { startedAt: SYNCED, completedAt: SYNCED, durationMs: 1 }, counts: COUNTS }),
        } as unknown as Response)
      }
      return new Promise(() => {})
    }))
  }

  const MP = {
    id: 'mp-1', name: 'Jane Doe', party: 'Liberal', ridingName: 'Nelson', ridingProvince: 'BC',
    email: null, photoUrl: null, active: true,
  }
  const VOTE = {
    id: 'v-1', session: '45-1', number: 12, date: '2026-10-01', descriptionEn: 'Second reading',
    result: 'passed', yeaTotal: 170, nayTotal: 150, pairedTotal: 0, billId: null, partyVotes: null,
    aiExplanation: null,
  }
  const BILL = {
    id: 'b-1', number: 'C-5', titleEn: 'An Act respecting rivers', titleFr: null, shortTitleEn: null,
    session: '45-1', statusCode: null, introduced: null, isLaw: false, legisInfoUrl: null,
    aiSummary: null, aiSummaryPromptVersion: null, sponsorName: null, sponsorParty: null, sponsorMpId: null,
  }
  const PROFILE = { userId: 'user-a', displayName: 'citizen', bio: null, avatarUrl: null, createdAt: new Date('2026-01-01T12:00:00Z') }

  async function expectHeader(container: HTMLElement, back: { href: string; label: string }, title: string) {
    const link = screen.getByRole('link', { name: back.label })
    expect(link.getAttribute('href')).toBe(back.href)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(title)
    expect(h1s[0].closest('[data-detail-header]')).not.toBeNull()
  }

  async function expectBadgeInMeta(container: HTMLElement) {
    const text = await screen.findByText(`Data as of ${localDate(SYNCED)}`)
    const meta = container.querySelector('[data-detail-header] [data-detail-meta]')
    expect(meta).not.toBeNull()
    expect(meta!.contains(text)).toBe(true)
    // Jen E1 C3: in the meta line, the date only (no counts), in the line's type.
    const badge = meta!.querySelector('[data-freshness]')!
    expect(badge.textContent).toBe(`Data as of ${localDate(SYNCED)}`)
    expect(badge.getAttribute('data-variant')).toBe('meta')
    expect(badge.className).toContain('text-xs font-normal')
    expect(badge.className).not.toContain('text-2xs')
  }

  it('/votes/mp goes back to Vote Tracker and shows the badge', async () => {
    stubNetwork()
    dbResults.push([MP])
    const { container } = render(await AllMPsPage())
    await expectHeader(container, { href: '/votes', label: 'Back to Vote Tracker' }, 'Members of Parliament')
    expect(container.querySelector('[data-detail-meta]')!.textContent).toContain('1 current MPs across 1 provinces and territories')
    await expectBadgeInMeta(container)
  })

  it('/votes/recent goes back to Vote Tracker and shows the badge', async () => {
    stubNetwork()
    const { container } = render(<RecentVotesPage />)
    await expectHeader(container, { href: '/votes', label: 'Back to Vote Tracker' }, 'Recent Votes')
    await expectBadgeInMeta(container)
  })

  it('/votes/mp/[mpId] goes back to MPs and shows the badge', async () => {
    stubNetwork()
    dbResults.push([MP])
    const { container } = render(await MpProfilePage({ params: Promise.resolve({ mpId: 'mp-1' }) }))
    await expectHeader(container, { href: '/votes/mp', label: 'Back to MPs' }, 'Jane Doe')
    await expectBadgeInMeta(container)
  })

  it('/votes/vote/[voteId] goes back to Vote Tracker and shows the badge', async () => {
    stubNetwork()
    dbResults.push([VOTE])
    const { container } = render(await VoteDetailPage({ params: Promise.resolve({ voteId: 'v-1' }) }))
    // Jen's E1 ruling, built in E2b: the h1 is the motion, and the division
    // number and date move to the meta line; nothing says the same thing twice.
    await expectHeader(container, { href: '/votes', label: 'Back to Vote Tracker' }, 'Second reading')
    await expectBadgeInMeta(container)
    const meta = container.querySelector('[data-detail-header] [data-detail-meta]')!
    expect(meta.querySelector('[data-division]')!.textContent).toBe('Vote 45-1/12')
    expect(meta.textContent).toContain('2026-10-01')
    expect(container.textContent!.split('Second reading').length - 1).toBe(1)
    expect(container.textContent!.split('45-1/12').length - 1).toBe(1)
    expect(container.textContent!.split('2026-10-01').length - 1).toBe(1)
  })

  // Jen E2b C9: the related-bill link joins number and title with a comma,
  // the House's own form, and no em dash.
  it('/votes/vote/[voteId] names the related bill as "C-5, An Act respecting rivers"', async () => {
    stubNetwork()
    dbResults.push([{ ...VOTE, billId: 'b-1' }], [{ id: 'b-1', number: 'C-5', titleEn: 'An Act respecting rivers' }])
    const { container } = render(await VoteDetailPage({ params: Promise.resolve({ voteId: 'v-1' }) }))
    const link = container.querySelector('a[href="/votes/bill/b-1"]')!
    expect(link.querySelector('p')!.textContent).toBe('C-5, An Act respecting rivers')
    expect(container.textContent).not.toContain('\u2014')
  })

  // Jen E2b C5: a motion over 140 characters steps the h1 down to 20/28 on
  // phones; at 140 or fewer it keeps the 24px h1.
  it('/votes/vote/[voteId] steps a motion over 140 characters down a size, and not one of 140', async () => {
    const h1Classes = async (descriptionEn: string) => {
      stubNetwork()
      dbResults.push([{ ...VOTE, descriptionEn }])
      const { container, unmount } = render(await VoteDetailPage({ params: Promise.resolve({ voteId: 'v-1' }) }))
      const h1 = container.querySelector('h1')!
      expect(h1.textContent).toBe(descriptionEn)
      const cls = h1.className.split(/\s+/)
      unmount()
      return cls
    }
    const at140 = await h1Classes('m'.repeat(140))
    expect(at140).toContain('text-2xl')
    expect(at140).not.toContain('text-xl')
    expect(at140).not.toContain('text-pretty')
    const at141 = await h1Classes('m'.repeat(141))
    expect(at141).toEqual(expect.arrayContaining(['text-xl', 'leading-7', 'sm:text-2xl', 'text-pretty', 'break-words']))
    expect(at141).not.toContain('text-2xl')
  })

  it('/votes/bill/[billId] goes back to Vote Tracker, titles the bill, and shows the badge', async () => {
    stubNetwork()
    dbResults.push([BILL], [])
    const { container } = render(await BillDetailPage({ params: Promise.resolve({ billId: 'b-1' }) }))
    await expectHeader(container, { href: '/votes', label: 'Back to Vote Tracker' }, 'An Act respecting rivers')
    await expectBadgeInMeta(container)
  })

  it('/u/[displayName] goes back to New Investigation, with no freshness badge', async () => {
    stubNetwork()
    dbResults.push([PROFILE], [], [{ lastActivity: null }])
    const { container } = render(await PublicProfilePage({ params: Promise.resolve({ displayName: 'citizen' }) }))
    await expectHeader(container, { href: '/investigate', label: 'Back to New Investigation' }, 'citizen')
    expect(container.querySelector('[data-freshness]')).toBeNull()
    expect(container.querySelector('[data-detail-header]')).not.toBeNull()
  })

  // Jen E1 C2: the name once (the h1), Joined and civic weight in the meta
  // line, and the card only when there is a bio.
  it('/u/[displayName] names the person once and puts Joined in the meta line; no bio, no card', async () => {
    stubNetwork()
    dbResults.push([PROFILE], [], [{ lastActivity: null }])
    const { container } = render(await PublicProfilePage({ params: Promise.resolve({ displayName: 'citizen' }) }))
    const meta = container.querySelector('[data-detail-header] [data-detail-meta]')!
    expect(meta.textContent).toBe(`Joined ${new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(PROFILE.createdAt)}`)
    expect(meta.textContent).not.toContain('Civic weight')
    expect(container.textContent!.split('citizen').length - 1).toBe(1)
    // The bio card is the header's next sibling when it renders; without a
    // bio the next sibling is the credential breakdown's wrapper.
    const next = container.querySelector('[data-detail-header]')!.nextElementSibling!
    expect(next.className).toBe('mt-6')
    expect(container.querySelector('p.max-w-md')).toBeNull()
  })

  it('/u/[displayName] with a bio and civic weight: weight in the meta line, bio in the card', async () => {
    stubNetwork()
    dbResults.push(
      [{ ...PROFILE, bio: 'Reads council minutes.' }],
      [{ type: 'foi_filed', count: 2, rawWeight: '6' }],
      [{ lastActivity: new Date().toISOString() }],
    )
    const { container } = render(await PublicProfilePage({ params: Promise.resolve({ displayName: 'citizen' }) }))
    const meta = container.querySelector('[data-detail-header] [data-detail-meta]')!
    expect(meta.textContent).toMatch(/^Joined .+Civic weight \d+$/)
    const card = container.querySelector('[data-detail-header]')!.nextElementSibling!
    expect(card.className).toContain('rounded-xl')
    expect(card.textContent).toBe('Reads council minutes.')
    expect(container.textContent!.split('citizen').length - 1).toBe(1)
  })

  it('/profile goes back to New Investigation, with no freshness badge', async () => {
    stubNetwork()
    dbResults.push([PROFILE], [], [{ lastActivity: null }])
    const { container } = render(await ProfilePage())
    await expectHeader(container, { href: '/investigate', label: 'Back to New Investigation' }, 'Profile')
    expect(container.querySelector('[data-detail-meta]')!.textContent).toBe('Your public identity')
    expect(container.querySelector('[data-freshness]')).toBeNull()
    expect(container.querySelector('[data-detail-header]')).not.toBeNull()
  })
})

/*
 * Jen E1 C1: on MP detail the DetailHeader h1 owns the name. The card stops
 * repeating it, leads with party and riding, and its photo or initial is
 * decorative.
 */
describe('MpProfileCard under DetailHeader', () => {
  const PROPS = { name: 'Jane Doe', party: 'Liberal', ridingName: 'Nelson', ridingProvince: 'BC', email: 'jane.doe@parl.gc.ca' }

  it('does not repeat the name, and the photo is decorative', () => {
    const { container } = render(<MpProfileCard {...PROPS} photoUrl="https://example.org/jane.jpg" />)
    expect(container.querySelector('h1, h2, h3')).toBeNull()
    expect(container.textContent).not.toContain('Jane Doe')
    expect(container.textContent).toContain('Nelson, BC')
    const img = container.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('aria-hidden')).toBe('true')
    const mail = screen.getByRole('link', { name: 'jane.doe@parl.gc.ca' })
    expect(mail.getAttribute('href')).toBe('mailto:jane.doe@parl.gc.ca')
  })

  it('without a photo, the initial is decorative', () => {
    const { container } = render(<MpProfileCard {...PROPS} photoUrl={null} />)
    const initial = Array.from(container.querySelectorAll('div')).find((d) => d.textContent === 'J')!
    expect(initial).toBeTruthy()
    expect(initial.getAttribute('aria-hidden')).toBe('true')
    expect(container.textContent).not.toContain('Jane Doe')
  })
})

/*
 * Jen E1 C4 and C5, checked against the CSS Tailwind actually compiles from
 * globals.css (the app's own pipeline), since jsdom has no layout: the h1's
 * class wraps, and the coarse-pointer target is an overlay, not layout.
 */
describe('DetailHeader compiled CSS', () => {
  let css = ''
  let compiled: Root
  let backClasses: string[] = []

  beforeAll(async () => {
    const file = path.resolve(__dirname, '../../src/app/globals.css')
    const result = await postcss([tailwind()]).process(fs.readFileSync(file, 'utf8'), { from: file })
    css = result.css
    compiled = postcss.parse(css)
    const { container } = render(
      <DetailHeader arm="votes" backHref="/votes" backLabel="Back to Vote Tracker" title="t" />
    )
    backClasses = container.querySelector('a')!.className.split(/\s+/)
    cleanup()
  }, 60_000)

  function declsFor(selectorPart: string): Record<string, string> {
    const out: Record<string, string> = {}
    compiled.walkRules((rule) => {
      if (!rule.selector.includes(selectorPart)) return
      rule.walkDecls((d) => { out[d.prop] = d.value })
    })
    return out
  }

  it('break-words compiles to overflow-wrap: break-word', () => {
    expect(declsFor('.break-words')['overflow-wrap']).toBe('break-word')
  })

  it('the back link stays a 24px box on coarse pointers; the 44px is an ::after overlay', () => {
    expect(backClasses).toContain('relative')
    expect(backClasses).toContain('min-h-6')
    expect(backClasses.some((c) => /^pointer-coarse:min-h-/.test(c))).toBe(false)
    expect(backClasses).toContain('pointer-coarse:after:absolute')
    expect(backClasses).toContain('pointer-coarse:after:-inset-y-2.5')
    expect(backClasses).toContain('pointer-coarse:after:inset-x-0')
    // The overlay rules exist, under the coarse-pointer query, on ::after.
    expect(css).toMatch(/pointer:\s*coarse/)
    const overlay = declsFor('pointer-coarse\\:after\\:-inset-y-2\\.5')
    expect(Object.keys(overlay).length).toBeGreaterThan(0)
    expect(JSON.stringify(overlay)).toMatch(/calc\(var\(--spacing\) \* -2\.5\)|-0\.625rem|-10px/)
    // Tailwind 4 nests: .class { @media (pointer: coarse) { &::after { ... } } }
    let afterAbsolute = false
    compiled.walkRules((rule) => {
      if (!rule.selector.includes('pointer-coarse\\:after\\:absolute')) return
      rule.walkRules((inner) => {
        const media = inner.parent?.type === 'atrule' ? (inner.parent as unknown as { params: string }).params : ''
        if (inner.selector.includes('::after') && /pointer:\s*coarse/.test(media)) {
          inner.walkDecls('position', (d) => { if (d.value === 'absolute') afterAbsolute = true })
        }
      })
    })
    expect(afterAbsolute).toBe(true)
  })
})
