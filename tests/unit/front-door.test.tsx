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
 * (fetch) and `matchMedia`.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
/** The signed-in user the request headers carry; null = signed out. */
let headerUser: string | null = null
vi.mock('next/headers', () => ({
  headers: async () => new Headers(headerUser ? { 'x-user-id': headerUser } : {}),
}))
const getDb = vi.fn((): unknown => {
  throw new Error('the database is not reached while signed out')
})
vi.mock('@/lib/db', () => ({ getDb: () => getDb() }))

import { CTAButton, type CTAButtonArm } from '@/components/ui/cta-button'
import InvestigatePage from '@/app/(app)/investigate/page'
import ScoutPage from '@/app/(app)/scout/page'
import { SCOUT_COPY, scoutErrorMessage } from '@/components/scout/discovery-form'

const JURISDICTIONS = [
  { id: 'j-van', name: 'City of Vancouver', country: 'CA', province: 'BC', municipalType: 'city', population: null, dataPortalUrl: null },
  { id: 'j-bc', name: 'Province of British Columbia', country: 'CA', province: 'BC', municipalType: 'province', population: null, dataPortalUrl: null },
]

let scoutBodies: Array<Record<string, unknown>>
/** How the stubbed discover answers: an empty finished stream (default), a
 *  stream held open until `releaseDiscover` and then one chunk of text, or a
 *  500 held the same way. */
let discoverMode: 'empty' | 'held' | 'held-error' | 'reject' | 'status'
let releaseDiscover: (() => void) | null
/** For discoverMode 'status': the status and body the route answers with
 *  (body null = not JSON, an HTML 502 from the edge). */
let discoverStatus: number
let discoverBody: unknown
let coarsePointer: boolean
let reducedMotion: boolean
const scrollTo = vi.fn()

beforeEach(() => {
  scoutBodies = []
  headerUser = null
  discoverMode = 'empty'
  releaseDiscover = null
  discoverStatus = 500
  discoverBody = null
  coarsePointer = false
  reducedMotion = false
  scrollTo.mockReset()
  // jsdom has no Element.scrollTo; the Scout results scroll calls it.
  ;(HTMLElement.prototype as unknown as { scrollTo: unknown }).scrollTo = scrollTo
  push.mockReset()
  getDb.mockClear()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      matches:
        (query === '(pointer: coarse)' && coarsePointer) ||
        (query === '(prefers-reduced-motion: reduce)' && reducedMotion),
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
        if (discoverMode === 'reject') throw new TypeError('Failed to fetch')
        if (discoverMode === 'status') {
          const body = discoverBody
          return {
            ok: false,
            status: discoverStatus,
            json: async () => {
              if (body === null) throw new SyntaxError('Unexpected token <')
              return body
            },
          }
        }
        if (discoverMode === 'empty') {
          // An empty finished stream: the search ran and returned nothing.
          return { ok: true, status: 200, body: new ReadableStream({ start: (c) => c.close() }) }
        }
        // Held until released; an abort rejects, as a real fetch does.
        await new Promise<void>((resolve, reject) => {
          releaseDiscover = resolve
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.')
            err.name = 'AbortError'
            reject(err)
          })
        })
        if (discoverMode === 'held-error') {
          return { ok: false, status: 500, json: async () => ({ error: 'Internal server error' }) }
        }
        // Two chunks in two tasks, as a real stream arrives, so the results
        // render twice (inside one act() React would batch them into one).
        const encode = (t: string) => new TextEncoder().encode(t)
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start: (c) => {
              c.enqueue(encode('## Council minutes\n'))
              setTimeout(() => {
                c.enqueue(encode('Found one record.'))
                c.close()
              }, 20)
            },
          }),
        }
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
    expect(query.placeholder).toBe('Rental bylaws')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
    const landmark = screen.getByRole('search', { name: 'Search public records' })
    expect(landmark.contains(query)).toBe(true)
    const classes = query.className.split(/\s+/)
    expect(classes).toContain('text-text-primary')
    expect(classes).toContain('text-base')
    // No UA clear glyph against the text (Jen C6); measured in the browser by
    // front-door-geometry.test.ts.
    expect(classes).toContain('[&::-webkit-search-cancel-button]:appearance-none')
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

  async function enter(query: HTMLElement, init: Record<string, unknown> = {}) {
    let notPrevented = true
    await act(async () => {
      notPrevented = fireEvent.keyDown(query, { key: 'Enter', ...init })
    })
    return notPrevented
  }

  // ─── submit guards (Razor W2) ──────────────────────────────────────────

  it('a whitespace-only query: Enter searches nothing, and the button says it is unavailable', async () => {
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: '   ' } })
    await enter(query)
    const button = screen.getByRole('button', { name: /Scout/ })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(scoutBodies).toEqual([])
  })

  it('the button is not natively disabled, so it keeps focus; it is enabled once there is a query', async () => {
    const { query } = await renderScout()
    const button = screen.getByRole('button', { name: /Scout/ }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.change(query, { target: { value: 'budget' } })
    expect(button.hasAttribute('aria-disabled')).toBe(false)
  })

  it('Enter while an IME is composing searches nothing', async () => {
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: '議事録' } })
    await enter(query, { isComposing: true })
    expect(scoutBodies).toEqual([])
  })

  it('Enter is consumed (default prevented) when it searches', async () => {
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    expect(await enter(query)).toBe(false)
    expect(scoutBodies).toHaveLength(1)
  })

  it('a second Enter while a search is in flight searches nothing; the field is locked but never disabled', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await enter(query)
    expect(scoutBodies).toHaveLength(1)
    expect(query.readOnly).toBe(true)
    expect(query.getAttribute('aria-disabled')).toBe('true')
    expect(query.disabled).toBe(false)
    await enter(query)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Scout' }))
    })
    expect(scoutBodies).toHaveLength(1)
    await act(async () => {
      releaseDiscover?.()
    })
    await waitFor(() => expect(query.readOnly).toBe(false))
    expect(query.hasAttribute('aria-disabled')).toBe(false)
  })

  it('once a search finishes, the next Enter searches again', async () => {
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await enter(query)
    await waitFor(() => expect(query.readOnly).toBe(false))
    fireEvent.change(query, { target: { value: 'minutes' } })
    await enter(query)
    expect(scoutBodies).toEqual([{ concern: 'budget' }, { concern: 'minutes' }])
  })

  it('two Enters dispatched in the same task search once (Razor N1)', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(scoutBodies).toHaveLength(1)
  })

  // ─── focus (Razor W1, Jen C3's lesson) ─────────────────────────────────

  it('focus stays on the query across Enter and the results rendering', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    query.focus()
    await enter(query)
    expect(document.activeElement).toBe(query)
    await act(async () => {
      releaseDiscover?.()
    })
    await waitFor(() => expect(screen.getByText('Discovery results')).toBeTruthy())
    expect(document.activeElement).toBe(query)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('focus stays on the query when the search fails', async () => {
    discoverMode = 'held-error'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    query.focus()
    await enter(query)
    expect(document.activeElement).toBe(query)
    await act(async () => {
      releaseDiscover?.()
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe("Scout couldn't finish that search. Search again."))
    expect(document.activeElement).toBe(query)
  })

  it('focus stays on the Scout button when it is clicked to search', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    const button = screen.getByRole('button', { name: /Scout/ })
    button.focus()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(document.activeElement).toBe(button)
    expect(button.getAttribute('aria-busy')).toBe('true')
    // jsdom has no focus fixup, so a natively disabled button would keep focus
    // here; the attribute is what the browser would drop focus on.
    expect((button as HTMLButtonElement).disabled).toBe(false)
    await act(async () => {
      releaseDiscover?.()
    })
    await waitFor(() => expect(screen.getByText('Discovery results')).toBeTruthy())
    expect(document.activeElement).toBe(button)
  })
})

// ─── design fix pass (Jen C1, C2, C4, C5, C9; Razor RW2) ───────────────────

describe('Investigate Start keeps one box (Jen C2)', () => {
  it('both labels share one cell; the one not showing is invisible and out of the name', async () => {
    const { textarea, start } = await renderInvestigate()
    const [rest, busy] = Array.from(start.querySelectorAll(':scope > span > span')) as HTMLElement[]
    expect(start.querySelector(':scope > span')?.className).toBe('grid')
    for (const label of [rest, busy]) expect(label.className).toContain('col-start-1 row-start-1')
    expect(rest.className).not.toContain('invisible')
    expect(busy.className.split(/\s+/)).toContain('invisible')
    expect(busy.getAttribute('aria-hidden')).toBe('true')
    expect(start.textContent).toContain('Starting…')
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    // Hold the POST so the busy state stays.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    })
    const busyButton = screen.getByRole('button', { name: 'Starting…' })
    expect(busyButton).toBe(start)
    expect(rest.className.split(/\s+/)).toContain('invisible')
    expect(rest.getAttribute('aria-hidden')).toBe('true')
    expect(busy.className).not.toContain('invisible')
    expect(busy.hasAttribute('aria-hidden')).toBe(false)
  })

  it('the reason line has its own row under Start at every width; Cancel comes after Start below md, beside it from md', async () => {
    const { textarea } = await renderInvestigate()
    const reason = document.getElementById('concern-submit-reason') as HTMLElement
    const reasonClasses = reason.className.split(/\s+/)
    // Beside Start it wraps above it in a 352px column (1024) and Start jumps
    // on the first keystroke (Razor N2): always its own row, after Start.
    expect(reasonClasses).toEqual(expect.arrayContaining(['order-last', 'basis-full']))
    expect(reasonClasses).not.toContain('md:order-none')
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    // Hold the POST so the busy state (and Cancel) shows.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel.className.split(/\s+/)).toEqual(expect.arrayContaining(['order-last', 'md:order-none']))
    expect(cancel.getAttribute('type')).toBe('button')
  })
})

describe('Scout button is the arm CTAButton (Jen C1, Razor RW1)', () => {
  it('rest, typed and busy: the arm recipe or the recessed one, never opacity, never natively disabled, always "Scout"', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    const button = screen.getByRole('button', { name: 'Scout' }) as HTMLButtonElement
    const states: Array<[string, ReturnType<typeof styleOf>]> = []
    states.push(['empty', styleOf(button)])
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.change(query, { target: { value: 'budget' } })
    states.push(['typed', styleOf(button)])
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    states.push(['busy', styleOf(button)])
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toBe('Scout')
    expect(screen.getByRole('button', { name: 'Scout' })).toBe(button)
    expect(states).toEqual([
      ['empty', RECESSED],
      ['typed', armRecipe('scout')],
      ['busy', armRecipe('scout')],
    ])
    expect(button.className).not.toMatch(/(^|\s)opacity-/)
    expect(button.disabled).toBe(false)
    expect(button.className.split(/\s+/)).toContain('shrink-0')
  })
})

describe('Scout errors: plain copy by status, in the slot under the query (Jen C4)', () => {
  const NOW = Date.UTC(2026, 9, 12, 20, 0, 0)

  it.each([
    [429, { error: 'Too many requests', code: 'rate_limited' }, SCOUT_COPY.rateLimited],
    [429, { error: 'Too many requests' }, SCOUT_COPY.rateLimited],
    [429, { code: 'daily_limit', reset: NOW }, SCOUT_COPY.unavailable],
    [429, { code: 'daily_limit', reset: NOW + 2 * 24 * 3600 * 1000 }, SCOUT_COPY.unavailable],
    [429, { code: 'daily_limit' }, SCOUT_COPY.unavailable],
    [500, { error: 'Internal server error' }, SCOUT_COPY.failed],
    [502, null, SCOUT_COPY.failed],
    [504, null, SCOUT_COPY.failed],
    [400, { error: 'concern is required' }, SCOUT_COPY.unreadable],
    [403, { error: 'Forbidden' }, SCOUT_COPY.failed],
  ])('%i %j -> plain copy', (status, body, expected) => {
    expect(scoutErrorMessage(status, body, NOW)).toBe(expected)
  })

  it.each([
    ['en-CA', 'It resets at 5:00 p.m.'],
    ['en-US', 'It resets at 5:00 PM.'],
    ['fr-CA', 'It resets at 17 h 00.'],
  ])('%s: the sentence ends in exactly one full stop (Razor RW3)', (locale, ending) => {
    const reset = Date.UTC(2026, 9, 13, 0, 0, 0)
    const message = scoutErrorMessage(429, { code: 'daily_limit', reset }, NOW, locale, 'America/Vancouver')
    expect(message).toBe(`You've reached the daily limit on AI requests. ${ending}`)
    expect(message).not.toMatch(/\.\.$/)
  })

  it('the per-minute line promises no wait: a spent daily limit or a Redis outage also lands there (Razor N1)', () => {
    expect(scoutErrorMessage(429, { code: 'rate_limited' }, NOW)).toBe('Too many searches for now. Search again later.')
    expect(SCOUT_COPY.rateLimited).not.toMatch(/minute|second|hour/i)
  })

  it('the daily limit names its reset in the reader\'s own clock, never "tomorrow"', () => {
    const reset = Date.UTC(2026, 9, 13, 0, 0, 0) // the next 00:00 UTC
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(reset)
    const message = scoutErrorMessage(429, { code: 'daily_limit', reset }, NOW)
    expect(message).toBe(`You've reached the daily limit on AI requests. It resets at ${time}.`)
    expect(message).not.toMatch(/tomorrow/i)
  })

  it('every message is a sentence: ends in a full stop, no "Please", no server words', () => {
    const all = [
      SCOUT_COPY.rateLimited,
      SCOUT_COPY.dailyLimit('5:00 PM'),
      SCOUT_COPY.unavailable,
      SCOUT_COPY.failed,
      SCOUT_COPY.unreadable,
      SCOUT_COPY.offline,
    ]
    for (const m of all) {
      expect(m).toMatch(/\.$/)
      expect(m).not.toMatch(/please|request failed|internal server|unauthorized|concern is required/i)
    }
  })

  it.each([
    ['429 per minute', 429, { error: 'Too many requests', code: 'rate_limited' }, SCOUT_COPY.rateLimited],
    ['an HTML 502', 502, null, SCOUT_COPY.failed],
  ])('%s: the page shows the plain line between the query row and the filters, describing the field', async (_n, status, body, expected) => {
    discoverMode = 'status'
    discoverStatus = status
    discoverBody = body
    const { query, jurisdiction } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(expected)
    expect(query.getAttribute('aria-describedby')).toBe(alert.id)
    expect(precedes(query, alert)).toBe(true)
    expect(precedes(alert, jurisdiction)).toBe(true)
  })

  it('a thrown fetch (offline) says so', async () => {
    discoverMode = 'reject'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect((await screen.findByRole('alert')).textContent).toBe(SCOUT_COPY.offline)
  })

  it('a 401 goes to login and back to Scout, with no message', async () => {
    discoverMode = 'status'
    discoverStatus = 401
    discoverBody = { error: 'Unauthorized' }
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(push).toHaveBeenCalledWith('/login?redirect=%2Fscout')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('the field is described by nothing while there is no error', async () => {
    const { query } = await renderScout()
    expect(query.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('Scout working line and Cancel (Jen C5)', () => {
  it('the start of a search is announced; Cancel sits in the slot under the query row', async () => {
    discoverMode = 'held'
    const { query, jurisdiction } = await renderScout()
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(status.textContent).toBe('Scouting…')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(cancel.getAttribute('type')).toBe('button')
    expect(precedes(query, cancel)).toBe(true)
    expect(precedes(cancel, jurisdiction)).toBe(true)
    expect(cancel.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-6', '[@media(pointer:coarse)]:min-h-11']))
    await act(async () => {
      releaseDiscover?.()
    })
    await waitFor(() => expect(status.textContent).toBe(''))
  })

  it('after Cancel, focus is on the query field, nothing is reported, and the next search goes through', async () => {
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    cancel.focus()
    const signal = (vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).signal as AbortSignal
    await act(async () => {
      fireEvent.click(cancel)
    })
    expect(signal.aborted).toBe(true)
    expect(document.activeElement).toBe(query)
    // The held stub never settles by itself; an aborted fetch rejects.
    await act(async () => {
      releaseDiscover?.()
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    discoverMode = 'empty'
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(scoutBodies).toHaveLength(2)
  })
})

describe('Scout frees itself after every failure (Razor RW2)', () => {
  it.each([
    ['an HTTP 500', 'status' as const],
    ['a network reject', 'reject' as const],
  ])('after %s, the next Enter searches', async (_n, mode) => {
    discoverMode = mode
    discoverStatus = 500
    discoverBody = { error: 'Internal server error' }
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    await screen.findByRole('alert')
    discoverMode = 'empty'
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(scoutBodies).toHaveLength(2)
  })

  it('after a 401, the next Enter searches (the redirect may not land)', async () => {
    discoverMode = 'status'
    discoverStatus = 401
    discoverBody = { error: 'Unauthorized' }
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    discoverMode = 'empty'
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(scoutBodies).toHaveLength(2)
  })
})

describe('Scout on a phone (Jen C9)', () => {
  it('on a coarse pointer, Enter moves focus to Scout before searching (closes the soft keyboard)', async () => {
    coarsePointer = true
    discoverMode = 'held'
    const { query } = await renderScout()
    fireEvent.change(query, { target: { value: 'budget' } })
    query.focus()
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Scout' }))
    expect(scoutBodies).toHaveLength(1)
  })

  it('on a coarse pointer, an empty Enter leaves focus in the field', async () => {
    coarsePointer = true
    const { query } = await renderScout()
    query.focus()
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    expect(document.activeElement).toBe(query)
  })

  /** Lay the page out by hand: jsdom has no layout. The scroll container is
   *  a wrapper with overflow-y auto, 667px tall, at the top of the screen. */
  async function renderInContainer(resultsTop: number) {
    const container = document.createElement('div')
    container.style.overflowY = 'auto'
    Object.defineProperty(container, 'scrollHeight', { value: 2000 })
    Object.defineProperty(container, 'clientHeight', { value: 667 })
    container.scrollTop = 40
    container.getBoundingClientRect = () => ({ top: 56, bottom: 667, left: 0, right: 375, width: 375, height: 611, x: 0, y: 56, toJSON: () => ({}) })
    document.body.appendChild(container)
    const real = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.tagName === 'SECTION' && this.textContent?.startsWith('Discovery results'))
        return { top: resultsTop, bottom: resultsTop + 100, left: 0, right: 375, width: 375, height: 100, x: 0, y: resultsTop, toJSON: () => ({}) }
      return real.call(this)
    })
    await act(async () => {
      render(<ScoutPage />, { container })
    })
    await waitFor(() => expect(screen.getByLabelText(/^Jurisdiction/).tagName).toBe('SELECT'))
    return { container, query: screen.getByLabelText('What documents are you looking for?') as HTMLInputElement }
  }

  async function searchAndRelease(query: HTMLElement) {
    fireEvent.change(query, { target: { value: 'budget' } })
    await act(async () => {
      fireEvent.keyDown(query, { key: 'Enter' })
    })
    await act(async () => {
      releaseDiscover?.()
    })
    await screen.findByText('Discovery results')
    // The second chunk arrives in a later task; the search ends after it.
    await waitFor(() => expect((query as HTMLInputElement).readOnly).toBe(false))
  }

  it('results below the fold: the container scrolls once, by arithmetic, to 16px above the heading', async () => {
    discoverMode = 'held'
    const { container, query } = await renderInContainer(640)
    await searchAndRelease(query)
    // scrollTop 40 + (640 - 56) - 16
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.contexts[0]).toBe(container)
    expect(scrollTo).toHaveBeenCalledWith({ top: 608, behavior: 'smooth' })
  })

  it('with reduced motion, the same scroll jumps instead of animating', async () => {
    discoverMode = 'held'
    reducedMotion = true
    const { query } = await renderInContainer(640)
    await searchAndRelease(query)
    expect(scrollTo).toHaveBeenCalledWith({ top: 608, behavior: 'auto' })
  })

  it('results already in view (heading and first line): no scroll', async () => {
    discoverMode = 'held'
    const { query } = await renderInContainer(400)
    await searchAndRelease(query)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('a second search scrolls again (once per search)', async () => {
    discoverMode = 'held'
    const { query } = await renderInContainer(640)
    await searchAndRelease(query)
    await waitFor(() => expect(query.readOnly).toBe(false))
    await searchAndRelease(query)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})

describe('Investigate with activity (Jen C3)', () => {
  it('two columns only from lg, so at 768 the form takes the full width', async () => {
    headerUser = 'a0000000-0000-4000-8000-00000000000a'
    const row = { id: 'i-1', concern: 'Logging above the intake', title: 'Logging above the intake', status: 'complete', createdAt: new Date() }
    // Each of the page's three reads: select().from().where().orderBy().limit().
    const chain = { select: () => chain, from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => [row] }
    getDb.mockImplementation(() => chain)
    const tree = (await InvestigatePage()) as ReactElement
    await act(async () => {
      render(tree)
    })
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeTruthy()
    const grid = screen.getByRole('heading', { level: 1 }).closest('.grid') as HTMLElement
    const classes = grid.className.split(/\s+/)
    expect(classes).toContain('lg:grid-cols-2')
    expect(classes).not.toContain('md:grid-cols-2')
  })
})
