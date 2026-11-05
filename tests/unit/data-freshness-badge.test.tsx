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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DataFreshnessBadge } from '@/components/votes/data-freshness-badge'
import { DetailHeader } from '@/components/layout/detail-header'

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

  describe('request failure: says "Sync time unknown", never a computed age', () => {
    it('when fetch rejects', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down') }))
      const { container } = render(<DataFreshnessBadge />)
      await screen.findByText('Sync time unknown')
      expectNoAge(container)
    })

    it('when the response is not OK', async () => {
      respondWith({ error: 'Too many requests' }, { ok: false, status: 429 })
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
    const meta = container.querySelector('[data-detail-meta]')
    expect(meta).not.toBeNull()
    expect(meta!.contains(screen.getByTestId('meta'))).toBe(true)
    const bar = container.querySelector('[data-accent-bar]') as HTMLElement
    expect(bar.getAttribute('style')).toContain('--accent-votes')
  })

  it('omits the meta line when there is no meta', () => {
    const { container } = render(
      <DetailHeader backHref="/investigate" backLabel="Back to Investigate" title="Profile" />
    )
    expect(container.querySelector('[data-detail-meta]')).toBeNull()
    expect(container.querySelector('h1')!.textContent).toBe('Profile')
    const bar = container.querySelector('[data-accent-bar]') as HTMLElement
    expect(bar.getAttribute('style')).toContain('--border-strong')
  })
})
