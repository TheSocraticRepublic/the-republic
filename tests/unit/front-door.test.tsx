// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'

/*
 * The front door (UI plan C1), rendered for real.
 *
 * - CTAButton's three recipes (primary, secondary, arm), and their disabled
 *   and busy states in each: disabled is the one recessed B3a style in every
 *   variant, busy keeps the variant's own full ink.
 * - The Investigate page, the async server component called as Next calls it
 *   and its tree rendered: the primary Start, no epigraph, the plain subhead,
 *   one jurisdiction explanation, primary text colour on every field.
 * - Scout: search-shaped, the query field first, its filters after, Enter
 *   searching.
 *
 * Stubbed only: the request headers (signed out, so no database read), the
 * database itself (asserted never reached), the Next router, the network
 * (fetch) and `matchMedia`. ScoutHistory is an async server component that
 * reads the database; it is replaced by nothing, since it is not C1's.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))
const getDb = vi.fn(() => {
  throw new Error('the database is not reached while signed out')
})
vi.mock('@/lib/db', () => ({ getDb: () => getDb() }))
vi.mock('@/components/scout/scout-history', () => ({ ScoutHistory: () => null }))

import { CTAButton, type CTAButtonArm } from '@/components/ui/cta-button'
import InvestigatePage from '@/app/(app)/investigate/page'
import ScoutPage from '@/app/(app)/scout/page'

const JURISDICTIONS = [
  { id: 'j-van', name: 'City of Vancouver', country: 'CA', province: 'BC', municipalType: 'city', population: null, dataPortalUrl: null },
  { id: 'j-bc', name: 'Province of British Columbia', country: 'CA', province: 'BC', municipalType: 'province', population: null, dataPortalUrl: null },
]

let scoutBodies: Array<Record<string, unknown>>

beforeEach(() => {
  scoutBodies = []
  push.mockReset()
  getDb.mockClear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  )
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/mirror/jurisdictions') {
        return { ok: true, status: 200, json: async () => ({ jurisdictions: JURISDICTIONS }) }
      }
      if (url === '/api/scout/discover' && init?.method === 'POST') {
        scoutBodies.push(JSON.parse(String(init.body)))
        // An empty finished stream: the search ran and returned nothing.
        return { ok: true, status: 200, body: new ReadableStream({ start: (c) => c.close() }) }
      }
      throw new Error(`unexpected fetch ${url}`)
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ─── CTAButton variants ──────────────────────────────────────────────────

type Props = ComponentProps<typeof CTAButton>
/** The props a case varies, merged loosely and cast once in renderCTA: the
 *  component's own union (link or button, arm or not) is checked at its real
 *  call sites by the typecheck. */
type CaseProps = { variant?: 'primary' | 'secondary' | 'arm'; arm?: CTAButtonArm; disabled?: boolean; busy?: boolean }

function renderCTA(props: CaseProps) {
  const onClick = vi.fn()
  render(<CTAButton {...({ onClick, ...props } as unknown as Props)}>Go</CTAButton>)
  return { onClick, button: screen.getByRole('button', { name: 'Go' }) }
}

const RECESSED = {
  backgroundColor: 'var(--surface-2)',
  color: 'var(--text-faint)',
  border: '1px solid var(--border)',
}

const SECONDARY = {
  backgroundColor: 'var(--surface-3)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
}

const PRIMARY = {
  backgroundColor: 'var(--text-primary)',
  color: 'var(--surface-0)',
  border: '1px solid var(--text-primary)',
}

function armRecipe(arm: CTAButtonArm) {
  return {
    backgroundColor: `color-mix(in srgb, var(--accent-${arm}) 15%, transparent)`,
    color: `var(--accent-${arm}-ink)`,
    border: `1px solid color-mix(in srgb, var(--accent-${arm}) 30%, transparent)`,
  }
}

function styleOf(el: HTMLElement) {
  return { backgroundColor: el.style.backgroundColor, color: el.style.color, border: el.style.border }
}

const ARMS: CTAButtonArm[] = ['scout', 'oracle', 'gadfly', 'lever', 'mirror', 'votes']

const VARIANTS: Array<[string, CaseProps, ReturnType<typeof styleOf>]> = [
  ['secondary (the default)', {}, SECONDARY],
  ['secondary (explicit)', { variant: 'secondary' }, SECONDARY],
  ['primary', { variant: 'primary' }, PRIMARY],
  ...ARMS.map((arm): [string, CaseProps, ReturnType<typeof styleOf>] => [
    `arm ${arm}`,
    { variant: 'arm', arm },
    armRecipe(arm),
  ]),
]

describe('CTAButton variants', () => {
  it.each(VARIANTS)('%s: its own recipe, enabled, and the click dispatches', (_name, props, recipe) => {
    const { button, onClick } = renderCTA(props)
    expect(styleOf(button)).toEqual(recipe)
    expect(button.hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each(VARIANTS)('%s, disabled: the one recessed style, aria-disabled, click refused', (_name, props) => {
    const { button, onClick } = renderCTA({ ...props, disabled: true })
    expect(styleOf(button)).toEqual(RECESSED)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.className).toContain('cursor-not-allowed')
    expect(button.className).not.toMatch(/opacity-/)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(VARIANTS)('%s, busy: keeps its own full ink, aria-busy, click refused', (_name, props, recipe) => {
    const { button, onClick } = renderCTA({ ...props, busy: true })
    expect(styleOf(button)).toEqual(recipe)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.className).toContain('cursor-progress')
    expect(button.className).not.toMatch(/opacity-/)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(VARIANTS)('%s, busy and disabled at once: busy wins', (_name, props, recipe) => {
    const { button } = renderCTA({ ...props, busy: true, disabled: true })
    expect(styleOf(button)).toEqual(recipe)
  })

  it('a link takes its variant too', () => {
    render(
      <>
        <CTAButton href="/a" variant="primary">Primary link</CTAButton>
        <CTAButton href="/b" variant="arm" arm="votes">Arm link</CTAButton>
        <CTAButton href="/c">Neutral link</CTAButton>
      </>
    )
    expect(styleOf(screen.getByRole('link', { name: 'Primary link' }))).toEqual(PRIMARY)
    expect(styleOf(screen.getByRole('link', { name: 'Arm link' }))).toEqual(armRecipe('votes'))
    expect(styleOf(screen.getByRole('link', { name: 'Neutral link' }))).toEqual(SECONDARY)
  })
})

// ─── Investigate ─────────────────────────────────────────────────────────

async function renderInvestigate() {
  const tree = (await InvestigatePage()) as ReactElement
  await act(async () => {
    render(tree)
  })
  // The jurisdiction select replaces its skeleton once the fetch settles.
  await waitFor(() => expect(document.getElementById('concern-jurisdiction')).not.toBeNull())
  return {
    textarea: screen.getByLabelText('Describe your concern') as HTMLTextAreaElement,
    select: document.getElementById('concern-jurisdiction') as HTMLSelectElement,
    postal: screen.getByLabelText(/^Postal code/) as HTMLInputElement,
    start: screen.getByRole('button', { name: /Start Investigation/ }),
  }
}

describe('Investigate front door', () => {
  it('signed out, it never reaches the database', async () => {
    await renderInvestigate()
    expect(getDb).not.toHaveBeenCalled()
  })

  it('Start is the primary CTA: full ink once there is a concern, full width on a phone', async () => {
    const { textarea, start } = await renderInvestigate()
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    expect(styleOf(start)).toEqual(PRIMARY)
    const classes = start.className.split(/\s+/)
    expect(classes).toContain('w-full')
    expect(classes).toContain('md:w-auto')
  })

  it('Start, before there is a concern: the recessed disabled style, with its reason', async () => {
    const { start } = await renderInvestigate()
    expect(styleOf(start)).toEqual(RECESSED)
    expect(start.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Describe your concern to start.')).toBeTruthy()
  })

  it('has no epigraph: no aphorism, and nothing set in the serif', async () => {
    const container = document.body
    await renderInvestigate()
    expect(screen.queryByText(/Every investigation begins/)).toBeNull()
    const serif = Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter((el) =>
      el.style.fontFamily.includes('--font-serif')
    )
    expect(serif).toEqual([])
    expect(container.querySelector('p.italic')).toBeNull()
  })

  it('the subhead is plain: what you do, what you get, and no "for you"', async () => {
    await renderInvestigate()
    const heading = screen.getByRole('heading', { level: 1, name: 'What concerns you?' })
    const subhead = heading.nextElementSibling as HTMLElement
    expect(subhead.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Describe a civic issue in your own words. You get one briefing: the documents that govern it, who is involved, and what you can do next.'
    )
    expect(subhead.textContent).not.toMatch(/for you/)
  })

  it('jurisdiction has one explanation, and it does not say "province" is usual', async () => {
    const { select } = await renderInvestigate()
    const label = document.querySelector('label[for="concern-jurisdiction"]') as HTMLElement
    expect(label.textContent).toBe('Jurisdiction (optional)')
    const hint = document.getElementById(select.getAttribute('aria-describedby') ?? '')
    expect(hint?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'The city, district or province your concern is about. It helps find the right documents.'
    )
    expect(document.body.textContent).not.toMatch(/usually your province/)
    expect(document.body.textContent).not.toMatch(/helps with document discovery/)
  })

  it('every field the citizen types into is set in the primary text colour', async () => {
    const { textarea, select, postal } = await renderInvestigate()
    for (const field of [textarea, select, postal]) {
      const classes = field.className.split(/\s+/)
      expect(classes).toContain('text-text-primary')
      expect(classes).not.toContain('text-text-secondary')
    }
  })
})

// ─── Scout ───────────────────────────────────────────────────────────────

async function renderScout() {
  await act(async () => {
    render(<ScoutPage />)
  })
  await waitFor(() => expect(screen.getByLabelText(/^Jurisdiction/).tagName).toBe('SELECT'))
  return {
    query: screen.getByLabelText('What documents are you looking for?') as HTMLInputElement,
    jurisdiction: screen.getByLabelText(/^Jurisdiction/) as HTMLSelectElement,
    policy: screen.getByLabelText(/^Policy area/) as HTMLSelectElement,
  }
}

function precedes(a: Element, b: Element) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('Scout is search-shaped', () => {
  it('one single-line query field, labelled for documents, inside a search landmark', async () => {
    const { query } = await renderScout()
    expect(query.tagName).toBe('INPUT')
    expect(query.type).toBe('search')
    expect(query.placeholder).toBe('Rental bylaw minutes')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    const landmark = screen.getByRole('search', { name: 'Search public records' })
    expect(landmark.contains(query)).toBe(true)
    const classes = query.className.split(/\s+/)
    expect(classes).toContain('text-text-primary')
    expect(classes).toContain('text-base')
  })

  it('the query comes first; the filters come after it, and the Scout button sits beside it', async () => {
    const { query, jurisdiction, policy } = await renderScout()
    const fields = Array.from(document.querySelectorAll('input, select, textarea'))
    expect(fields[0]).toBe(query)
    expect(precedes(query, jurisdiction)).toBe(true)
    expect(precedes(query, policy)).toBe(true)
    const scout = screen.getByRole('button', { name: /Scout/ })
    expect(query.parentElement).toBe(scout.parentElement)
    expect(precedes(scout, jurisdiction)).toBe(true)
  })

  it('it is no longer a second concern form', async () => {
    await renderScout()
    expect(screen.queryByText('What concerns you?')).toBeNull()
    expect(screen.queryByText(/Describe your concern/i)).toBeNull()
    expect(screen.queryByText(/^Try:/)).toBeNull()
  })

  it('Enter in the query searches, with the filters sent along', async () => {
    const { query, jurisdiction, policy } = await renderScout()
    fireEvent.change(query, { target: { value: '  council minutes  ' } })
    fireEvent.change(jurisdiction, { target: { value: 'j-van' } })
    fireEvent.change(policy, { target: { value: 'housing' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(scoutBodies).toEqual([{ concern: 'council minutes', jurisdictionId: 'j-van', policyArea: 'housing' }])
  })

  it('Enter with an empty query searches nothing; other keys never search', async () => {
    const { query } = await renderScout()
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    fireEvent.change(query, { target: { value: 'council minutes' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'a' })
    })
    expect(scoutBodies).toEqual([])
  })

  it('the Scout button searches the same query', async () => {
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget 2024' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Scout/ }))
    })
    expect(scoutBodies).toEqual([{ concern: 'budget 2024' }])
  })
})
