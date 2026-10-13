// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createHash, createHmac } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Browser } from 'playwright'

/*
 * One field recipe (UI plan C2b), the forms rendered for real.
 *
 * - `Field`: the label names the control; "(optional)" is a faint
 *   parenthetical; the description and the error are the control's
 *   description, and the error makes it aria-invalid (app-arms P2-12).
 * - Each converted form keeps what it said before: its labels, its groups,
 *   its descriptions and errors, its guards, and the dialogs' trigger
 *   semantics and focus return. Its buttons are CTAButton's arm recipe
 *   (app-arms P2-2) and its controls the one control recipe.
 * - Investigations has one way in at a time (app-arms Q4); its header wraps
 *   instead of clipping "New Investigation" at 320 (Jen C1 C8).
 * - No `calc(100vh-4rem)` is left (mobile P2-12).
 *
 * Only the network (fetch), the Next router, the request headers and the
 * database are stubbed. The 320 measurement needs layout, so it runs in
 * Chromium against this worktree's QA harness when it is up; otherwise it is
 * skipped with a marker, and QA_REQUIRE_HARNESS=1 makes the skip a failure.
 */

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(window.location.search),
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`)
  },
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-user-id': 'user-a' }),
}))
/** What the investigations list query returns. */
let investigationRows: unknown[] = []
vi.mock('@/lib/db', () => ({
  getDb: () => ({
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: async () => investigationRows }) }) }),
  }),
}))
vi.mock('next/link', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, replace: _r, children, ...rest }: { href: string; replace?: boolean; children?: import('react').ReactNode } & Record<string, unknown>) =>
      createElement('a', { href, ...rest }, children),
  }
})

import { Field, FieldLabel, SECTION_LABEL_CLASS, fieldControlClass } from '@/components/ui/field'
import { CTAButton } from '@/components/ui/cta-button'
import { NewSessionDialog } from '@/components/gadfly/new-session-dialog'
import { NewActionDialog } from '@/components/lever/new-action-dialog'
import { ComparisonForm } from '@/components/mirror/comparison-form'
import { DiscoveryForm } from '@/components/scout/discovery-form'
import InvestigationsPage from '@/app/(app)/investigations/page'

const REPO = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(REPO, rel), 'utf8')

type Json = Record<string, unknown>
let fetchCalls: Array<{ url: string; init?: RequestInit }>

/** Every list the forms fetch answers empty; `overrides` answers by URL. */
function installFetch(overrides: Record<string, (init?: RequestInit) => unknown> = {}) {
  fetchCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init })
      const respond = (body: Json, status = 200) => ({ ok: status < 400, status, json: async () => body, body: null })
      const key = `${init?.method ?? 'GET'} ${url}`
      if (overrides[key]) return overrides[key](init)
      if (url === '/api/oracle/documents') return respond({ documents: [] })
      if (url === '/api/gadfly/session') return respond({ sessions: [] })
      if (url === '/api/mirror/jurisdictions') return respond({ jurisdictions: [] })
      if (url === '/api/lever/actions') return respond({ actions: [] })
      throw new Error(`unexpected fetch ${key}`)
    })
  )
}

const posts = (url: string) => fetchCalls.filter((c) => c.url === url && c.init?.method === 'POST')

/** The text an element's aria-describedby points at, joined, as a screen
 *  reader reads it; null with no reference. */
function description(el: Element): string | null {
  const ids = el.getAttribute('aria-describedby')
  if (!ids) return null
  return ids
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? `<missing ${id}>`)
    .join(' ')
}

/** The arm recipe's inline style, as CTAButton paints it. */
function expectArmRecipe(button: HTMLElement, arm: string) {
  expect(button.style.color).toBe(`var(--accent-${arm}-ink)`)
  expect(button.style.backgroundColor).toBe(`color-mix(in srgb, var(--accent-${arm}) 15%, transparent)`)
  expect(button.style.border).toContain(`color-mix(in srgb, var(--accent-${arm}) 30%, transparent)`)
  expect(button.className).not.toMatch(/opacity-(40|50)/)
}

/** Unavailable, every variant shares one recessed style (B3a). */
function expectUnavailable(button: HTMLElement) {
  expect(button.getAttribute('aria-disabled')).toBe('true')
  expect(button.style.color).toBe('var(--text-faint)')
  expect(button.style.backgroundColor).toBe('var(--surface-2)')
}

/** The control recipe, as fieldControlClass paints it. */
function expectControlRecipe(el: Element, arm: string) {
  for (const cls of ['border-border-strong', 'bg-surface-1', 'text-text-primary', `focus:border-[var(--accent-${arm})]/40`]) {
    expect(el.classList.contains(cls), `${el.id} has ${cls}`).toBe(true)
  }
  expect(el.classList.contains('border-border')).toBe(false)
}

/** The field label recipe: secondary ink, and a faint "(optional)". */
function expectLabelRecipe(control: HTMLElement, optional: boolean) {
  const label = (control as HTMLInputElement).labels?.[0] as HTMLLabelElement
  expect(label, `a label for ${control.id}`).toBeTruthy()
  expect(label.className).toContain('text-text-secondary')
  expect(label.className).toContain('text-xs')
  const paren = label.querySelector('span')
  if (optional) {
    expect(paren?.textContent).toBe('(optional)')
    expect(paren?.className).toBe('text-text-faint')
  } else {
    expect(paren).toBeNull()
  }
}

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ─── Field ─────────────────────────────────────────────────────────────────

describe('Field', () => {
  it('its label names the control, with a faint "(optional)" when asked', () => {
    render(
      <>
        <Field id="f-a" label="Title" optional>
          {(c) => <input {...c} />}
        </Field>
        <Field id="f-b" label="Question">
          {(c) => <textarea {...c} />}
        </Field>
      </>
    )
    const a = screen.getByLabelText('Title (optional)')
    expect(a.id).toBe('f-a')
    expectLabelRecipe(a, true)
    const b = screen.getByLabelText('Question')
    expect(b.tagName).toBe('TEXTAREA')
    expectLabelRecipe(b, false)
  })

  it('a field with no description and no error has no description reference and is not invalid', () => {
    render(<Field label="Title">{(c) => <input {...c} />}</Field>)
    const input = screen.getByLabelText('Title')
    expect(input.id).not.toBe('')
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('the description is always the control’s description', () => {
    render(
      <Field id="f" label="Province" description="Choose the province this request goes to.">
        {(c) => <select {...c} />}
      </Field>
    )
    const select = screen.getByLabelText('Province')
    expect(description(select)).toBe('Choose the province this request goes to.')
    expect(select.hasAttribute('aria-invalid')).toBe(false)
    const p = document.getElementById('f-description')!
    expect(p.className).toContain('text-text-muted')
    expect(p.className).toContain('text-xs')
  })

  it('an error describes the control after its description, makes it invalid, and goes when cleared', () => {
    const { rerender } = render(
      <Field id="f" label="Body" description="Hint." error="Pick a body from the list.">
        {(c) => <input {...c} />}
      </Field>
    )
    const input = screen.getByLabelText('Body')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('f-description f-error')
    expect(description(input)).toBe('Hint. Pick a body from the list.')
    const error = screen.getByText('Pick a body from the list.')
    expect(error.className).toContain('text-status-danger')
    // Not an alert: the form decides whether to announce or focus it.
    expect(error.getAttribute('role')).toBeNull()

    for (const cleared of [null, undefined, '']) {
      rerender(
        <Field id="f" label="Body" description="Hint." error={cleared}>
          {(c) => <input {...c} />}
        </Field>
      )
      expect(screen.queryByText('Pick a body from the list.')).toBeNull()
      expect(input.hasAttribute('aria-invalid')).toBe(false)
      expect(input.getAttribute('aria-describedby')).toBe('f-description')
    }
  })

  it('describedBy adds text rendered elsewhere, and the render prop names the error id', () => {
    let errorId = ''
    render(
      <>
        <Field id="q" label="Query" describedBy="slot" error="Bad.">
          {(c, ids) => {
            errorId = ids.errorId
            return <input {...c} />
          }}
        </Field>
        <p id="slot">Elsewhere.</p>
      </>
    )
    expect(errorId).toBe('q-error')
    expect(screen.getByLabelText('Query').getAttribute('aria-describedby')).toBe('q-error slot')
  })

  it('FieldLabel is the same label, for a group named by its own aria-label', () => {
    render(<FieldLabel optional>Mode</FieldLabel>)
    const label = screen.getByText('Mode')
    expect(label.tagName).toBe('LABEL')
    expect(label.className).toContain('text-text-secondary')
    expect(label.querySelector('span')?.className).toBe('text-text-faint')
  })

  it('the recipes: one control class per arm, one section label', () => {
    const select = fieldControlClass('lever', 'select')
    expect(select).toContain('border-border-strong')
    expect(select).toContain('bg-surface-1')
    expect(select).toContain('text-text-primary')
    expect(select).toContain('appearance-none')
    expect(select).toContain('focus:border-[var(--accent-lever)]/40')
    expect(fieldControlClass('mirror', 'textarea')).toContain('resize-none')
    expect(fieldControlClass('mirror')).not.toContain('appearance-none')
    // text-sm, never a 16px-or-more size: the unlayered phone rule raises it
    // to 16px below 768px (B1), and a size class would opt out of it.
    expect(select).toContain('text-sm')
    expect(select).not.toMatch(/text-(base|lg|xl)/)
    expect(SECTION_LABEL_CLASS.split(' ').sort()).toEqual(
      ['font-semibold', 'text-text-muted', 'text-xs', 'tracking-widest', 'uppercase'].sort()
    )
  })
})

// ─── CTAButton additions the dialogs need ─────────────────────────────────

describe('CTAButton pass-through and onUnavailable', () => {
  it('passes native attributes through, but never over its own', () => {
    const onClick = vi.fn()
    render(
      <CTAButton variant="arm" arm="gadfly" onClick={onClick} aria-haspopup="dialog" aria-expanded={false} data-state="closed">
        Go
      </CTAButton>
    )
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('data-state')).toBe('closed')
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('onUnavailable runs on a disabled activation, never on an available or busy one', () => {
    const onClick = vi.fn()
    const onUnavailable = vi.fn()
    const { rerender } = render(
      <CTAButton onClick={onClick} onUnavailable={onUnavailable} disabled>
        Go
      </CTAButton>
    )
    const button = screen.getByRole('button', { name: 'Go' })
    fireEvent.click(button)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
    rerender(
      <CTAButton onClick={onClick} onUnavailable={onUnavailable} disabled busy>
        Go
      </CTAButton>
    )
    fireEvent.click(button)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
    rerender(
      <CTAButton onClick={onClick} onUnavailable={onUnavailable}>
        Go
      </CTAButton>
    )
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onUnavailable).toHaveBeenCalledTimes(1)
  })
})

// ─── Gadfly: Begin Inquiry ─────────────────────────────────────────────────

describe('Gadfly’s create dialog', () => {
  it('the trigger is the arm button and still the dialog’s trigger; closing hands focus back to it', async () => {
    installFetch()
    render(<NewSessionDialog />)
    const trigger = screen.getByRole('button', { name: 'New Inquiry' })
    expectArmRecipe(trigger, 'gadfly')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('keeps its labels, its optional fields and its mode group, on the one recipe', async () => {
    installFetch()
    render(<NewSessionDialog initialOpen />)
    fireEvent.click(screen.getByRole('button', { name: 'New Inquiry' }))
    const doc = await screen.findByLabelText('Document (optional)')
    expect(doc.tagName).toBe('SELECT')
    expect(doc.id).toBe('session-document')
    expectControlRecipe(doc, 'gadfly')
    expectLabelRecipe(doc, true)
    const title = screen.getByLabelText('Title (optional)')
    expect(title.id).toBe('session-title')
    expectControlRecipe(title, 'gadfly')
    const group = screen.getByRole('group', { name: 'Inquiry mode' })
    expect(group.querySelectorAll('button[aria-pressed]')).toHaveLength(2)
    expect(screen.getByText('Mode').tagName).toBe('LABEL')
  })

  it('Begin Inquiry is the arm button: busy, it keeps focus and sends one create', async () => {
    let answer!: (v: unknown) => void
    installFetch({
      'POST /api/gadfly/session': () =>
        new Promise((r) => {
          answer = r
        }),
    })
    render(<NewSessionDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'New Inquiry' }))
    const begin = await screen.findByRole('button', { name: 'Begin Inquiry' })
    expectArmRecipe(begin, 'gadfly')
    begin.focus()
    act(() => {
      begin.click()
    })
    const busy = await screen.findByRole('button', { name: 'Creating...' })
    expect(busy).toBe(begin)
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect((busy as HTMLButtonElement).disabled).toBe(false)
    expect(document.activeElement).toBe(busy)
    fireEvent.click(busy)
    expect(posts('/api/gadfly/session')).toHaveLength(1)
    await act(async () => {
      answer({ ok: true, status: 200, json: async () => ({ sessionId: 's-1' }) })
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/gadfly/s-1'))
  })

  it('a failed create is still announced', async () => {
    installFetch({ 'POST /api/gadfly/session': () => ({ ok: false, status: 500, json: async () => ({}) }) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<NewSessionDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'New Inquiry' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Begin Inquiry' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Failed to create inquiry. Try again.')
  })
})

// ─── Lever: New Civic Action ───────────────────────────────────────────────

describe('Lever’s create dialog', () => {
  const BC = { investigation: { concern: 'x', jurisdictionName: 'City of Burnaby', jurisdictionProvince: 'British Columbia' } }

  function openFromInvestigation(investigation: Json = BC) {
    installFetch({ 'GET /api/investigate/inv-1': () => ({ ok: true, status: 200, json: async () => investigation }) })
    render(<NewActionDialog initialInvestigationId="inv-1" initialActionType="fippa_request" />)
  }

  it('the trigger is the arm button and still the dialog’s trigger; closing hands focus back to it', async () => {
    installFetch()
    render(<NewActionDialog />)
    const trigger = screen.getByRole('button', { name: 'New Action' })
    expectArmRecipe(trigger, 'lever')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    trigger.focus()
    fireEvent.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('the province select is required and described by its hint, caveat first', async () => {
    openFromInvestigation({ investigation: { concern: 'x', jurisdictionName: 'Synthetic County', jurisdictionProvince: 'Alberta' } })
    const province = (await screen.findByLabelText('Province')) as HTMLSelectElement
    await waitFor(() => expect(province.value).toBe('ab'))
    expect(province.required).toBe(true)
    expectControlRecipe(province, 'lever')
    expectLabelRecipe(province, false)
    expect(description(province)).toBe(
      "Open Cave has not verified Alberta's legal citations yet. Check each one against the Act before you file." +
        'Detected from your investigation. Change it if it is wrong.'
    )
  })

  it('the body select, its "Other" name and every other field keep their labels on the one recipe', async () => {
    openFromInvestigation()
    await waitFor(() => expect((screen.getByLabelText('Province') as HTMLSelectElement).value).toBe('bc'))
    const body = screen.getByLabelText('Public body (optional)') as HTMLSelectElement
    expect(body.id).toBe('action-public-body')
    expectControlRecipe(body, 'lever')
    expect(body.hasAttribute('aria-describedby')).toBe(false)
    fireEvent.change(body, { target: { value: '__other__' } })
    expectControlRecipe(screen.getByLabelText('Public body name'), 'lever')
    for (const name of ['Oracle document (optional)', 'Gadfly inquiry (optional)']) {
      const select = await screen.findByLabelText(name)
      expect(select.tagName).toBe('SELECT')
      expectControlRecipe(select, 'lever')
    }
    const records = screen.getByLabelText('What records do you want?')
    expect(records.id).toBe('action-description')
    expectControlRecipe(records, 'lever')
    expect(screen.getByRole('group', { name: 'Action type' })).toBeTruthy()
    expect(screen.getByText('Document type').tagName).toBe('LABEL')
  })

  it('a body refusal describes the select, or the "Other" name when that holds the body, never both', async () => {
    const message = 'That body is in the British Columbia directory.'
    installFetch({
      'GET /api/investigate/inv-1': () => ({ ok: true, status: 200, json: async () => BC }),
      'POST /api/lever/actions': () => ({ ok: false, status: 400, json: async () => ({ error: message, field: 'publicBody' }) }),
    })
    render(<NewActionDialog initialInvestigationId="inv-1" initialActionType="fippa_request" />)
    await waitFor(() => expect((screen.getByLabelText('Province') as HTMLSelectElement).value).toBe('bc'))
    const body = screen.getByLabelText('Public body (optional)') as HTMLSelectElement
    fireEvent.change(body, { target: { value: 'BC Ministry of Forests' } })
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await screen.findByText(message)
    expect(body.getAttribute('aria-invalid')).toBe('true')
    expect(description(body)).toBe(message)
    await waitFor(() => expect(document.activeElement).toBe(body))

    fireEvent.change(body, { target: { value: '__other__' } })
    const other = screen.getByLabelText('Public body name')
    fireEvent.change(other, { target: { value: 'BC Ministry of Forests' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await screen.findByText(message)
    expect(other.getAttribute('aria-invalid')).toBe('true')
    expect(description(other)).toBe(message)
    expect(body.hasAttribute('aria-invalid')).toBe(false)
    expect(body.hasAttribute('aria-describedby')).toBe(false)
  })

  it('Generate is the arm button; incomplete, it is aria-disabled, says why, and takes focus to what is missing', async () => {
    openFromInvestigation({ investigation: { concern: 'x', jurisdictionName: 'Nowhere', jurisdictionProvince: null } })
    await screen.findByText('Choose the province this request goes to.')
    const generate = screen.getByRole('button', { name: 'Generate' })
    // Empty description: activation goes to the description.
    expectUnavailable(generate)
    fireEvent.click(generate)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('What records do you want?')))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    expect(description(generate)).toBe('Choose a province to generate this request.')
    fireEvent.click(generate)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Province')))
    expect(posts('/api/lever/actions')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Province'), { target: { value: 'bc' } })
    expect(generate.hasAttribute('aria-disabled')).toBe(false)
    expect(generate.hasAttribute('aria-describedby')).toBe(false)
    expectArmRecipe(generate, 'lever')
  })
})

// ─── Mirror ────────────────────────────────────────────────────────────────

describe('Mirror’s comparison form', () => {
  it('asks its question first, then two optional selects, on the one recipe', async () => {
    installFetch()
    const { container } = render(<ComparisonForm />)
    const question = screen.getByLabelText('What policy question do you want to compare?')
    expect(question.tagName).toBe('TEXTAREA')
    expect(question.id).toBe('compare-description')
    expectControlRecipe(question, 'mirror')
    expectLabelRecipe(question, false)
    const doc = await screen.findByLabelText('Linked document (optional)')
    const area = screen.getByLabelText('Policy area (optional)')
    expect(doc.id).toBe('compare-document')
    expect(area.id).toBe('compare-policy-area')
    expectControlRecipe(doc, 'mirror')
    expectControlRecipe(area, 'mirror')
    const controls = [...container.querySelectorAll('textarea, select')]
    expect(controls.map((c) => c.id)).toEqual(['compare-description', 'compare-document', 'compare-policy-area'])
    expect(container.querySelector('h2')!.className).toBe(`mb-4 ${SECTION_LABEL_CLASS}`)
  })

  it('Compare is the arm button: aria-disabled and inert with no question, live with one', async () => {
    installFetch({
      'POST /api/mirror/compare': () => ({ ok: false, status: 400, json: async () => ({ error: 'Add a question.' }) }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ComparisonForm />)
    const compare = screen.getByRole('button', { name: 'Compare' })
    expectUnavailable(compare)
    expect((compare as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(compare)
    expect(posts('/api/mirror/compare')).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('What policy question do you want to compare?'), { target: { value: 'Rentals?' } })
    expect(compare.hasAttribute('aria-disabled')).toBe(false)
    expectArmRecipe(compare, 'mirror')
    fireEvent.click(compare)
    expect((await screen.findByRole('alert')).textContent).toBe('Add a question.')
    expect(posts('/api/mirror/compare')).toHaveLength(1)
  })

  it('busy, Compare keeps focus, says so, and sends one comparison', async () => {
    let answer!: (v: unknown) => void
    installFetch({
      'POST /api/mirror/compare': () =>
        new Promise((r) => {
          answer = r
        }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ComparisonForm />)
    fireEvent.change(screen.getByLabelText('What policy question do you want to compare?'), { target: { value: 'Rentals?' } })
    const compare = screen.getByRole('button', { name: 'Compare' })
    compare.focus()
    fireEvent.click(compare)
    const busy = await screen.findByRole('button', { name: 'Comparing...' })
    expect(busy).toBe(compare)
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(busy)
    expectArmRecipe(busy, 'mirror')
    fireEvent.click(busy)
    expect(posts('/api/mirror/compare')).toHaveLength(1)
    await act(async () => {
      answer({ ok: false, status: 500, json: async () => ({}) })
    })
    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong. Try again.')
  })

  it('a document list that fails to load is announced, and the select is not marked invalid', async () => {
    installFetch({ 'GET /api/oracle/documents': () => Promise.reject(new Error('offline')) })
    render(<ComparisonForm />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Couldn’t load your documents. You can still compare without a linked document.'.replace('’', "'"))
    const doc = screen.getByLabelText('Linked document (optional)')
    expect(doc.hasAttribute('aria-invalid')).toBe(false)
    expect(doc.hasAttribute('aria-describedby')).toBe(false)
  })
})

// ─── Scout ─────────────────────────────────────────────────────────────────

describe('Scout’s discovery form', () => {
  it('keeps its query label, its arm button beside it and two optional filters on the one recipe', async () => {
    installFetch()
    const { container } = render(<DiscoveryForm />)
    const query = screen.getByLabelText('What documents are you looking for?')
    expect(query.getAttribute('type')).toBe('search')
    expectLabelRecipe(query, false)
    expect(query.hasAttribute('aria-describedby')).toBe(false)
    const scout = screen.getByRole('button', { name: 'Scout' })
    expectUnavailable(scout)
    fireEvent.change(query, { target: { value: 'Rental bylaws' } })
    expectArmRecipe(scout, 'scout')
    const jurisdiction = await screen.findByLabelText('Jurisdiction (optional)')
    const area = screen.getByLabelText('Policy area (optional)')
    expectControlRecipe(jurisdiction, 'scout')
    expectControlRecipe(area, 'scout')
    expect(container.querySelector('h2')!.className).toBe(`mb-4 ${SECTION_LABEL_CLASS}`)
    // The query still comes first.
    expect([...container.querySelectorAll('input, select')].map((c) => c.id)).toEqual([query.id, jurisdiction.id, area.id])
  })

  it('a failed search describes the query field, in the slot under the row', async () => {
    installFetch({ 'POST /api/scout/discover': () => ({ ok: false, status: 400, json: async () => ({}) }) })
    render(<DiscoveryForm />)
    const query = screen.getByLabelText('What documents are you looking for?')
    fireEvent.change(query, { target: { value: 'Rental bylaws' } })
    fireEvent.click(screen.getByRole('button', { name: 'Scout' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe("Scout couldn't read that search. Search again.")
    expect(description(query)).toBe(alert.textContent)
    // The slot is not inside the field's block.
    expect(query.closest('div.flex')!.contains(alert)).toBe(false)
  })
})

// ─── Investigations: one way in ────────────────────────────────────────────

describe('Investigations', () => {
  const ROW = {
    id: 'inv-1',
    concern: 'A gravel mine expansion was approved.',
    jurisdictionName: null,
    status: 'complete',
    briefingText: '# Title',
    failureReason: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
  }
  const toInvestigate = () => [...document.querySelectorAll('a[href="/investigate"]')]

  it('with none, the empty state is the one way in: no header button', async () => {
    investigationRows = []
    render(await InvestigationsPage())
    expect(toInvestigate().map((a) => a.textContent)).toEqual(['Start your first investigation'])
    expect(screen.queryByText('New Investigation')).toBeNull()
  })

  it('with some, the header button is the one way in', async () => {
    investigationRows = [ROW]
    render(await InvestigationsPage())
    const links = toInvestigate()
    expect(links.map((a) => a.textContent)).toEqual(['New Investigation'])
    expect(screen.queryByText('Start your first investigation')).toBeNull()
  })

  it('the header wraps rather than clipping the button (its layout is measured at 320 below)', async () => {
    investigationRows = [ROW]
    render(await InvestigationsPage())
    const header = screen.getByRole('heading', { level: 1 }).closest('div')!.parentElement!
    expect(header.classList.contains('flex')).toBe(true)
    expect(header.classList.contains('flex-wrap')).toBe(true)
    expect(header.contains(screen.getByText('New Investigation'))).toBe(true)
  })
})

// ─── No viewport sums ──────────────────────────────────────────────────────

describe('mobile P2-12', () => {
  it('no calc(100vh-4rem) is left in the app, and Investigate fills the scroller instead', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.(tsx?|css)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('calc(100vh-4rem)')) offenders.push(full)
      }
    }
    walk(path.join(REPO, 'src'))
    expect(offenders).toEqual([])
    const page = read('src/app/(app)/investigate/page.tsx')
    expect(page).toContain('<div className="relative min-h-full">')
  })

  it('field.tsx is not a client module, so a server page reads its class strings as strings', () => {
    const source = read('src/components/ui/field.tsx')
    expect(source).toContain('export const SECTION_LABEL_CLASS =')
    expect(source).not.toMatch(/^\s*['"]use client['"]/m)
    expect(typeof SECTION_LABEL_CLASS).toBe('string')
  })

  it('Investigate’s Recent Activity heading is the one section label', () => {
    const page = read('src/app/(app)/investigate/page.tsx')
    expect(page).toContain('<h2 className={`mb-6 ${SECTION_LABEL_CLASS}`}>Recent Activity</h2>')
    expect(page).not.toContain('tracking-wider')
  })
})

// ─── 320, measured (harness) ───────────────────────────────────────────────

const APP_URL = 'http://127.0.0.1:3177'
const USER_A = 'a0000000-0000-4000-8000-00000000000a'

function harnessState(): { jwtSecret: string } | null {
  const stateDir = path.join(os.tmpdir(), `open-cave-qa-${createHash('sha1').update(REPO).digest('hex').slice(0, 10)}`)
  try {
    return JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'))
  } catch {
    return null
  }
}

async function appReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${APP_URL}/api/health`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

const STATE = harnessState()
const APP_UP = STATE !== null && (await appReachable())

if (!APP_UP) {
  const message = '[field-recipe] SKIPPED: the QA harness is not running for this worktree (npx tsx scripts/qa/harness.ts up).'
  if (process.env.QA_REQUIRE_HARNESS === '1') throw new Error(message.replace('SKIPPED', 'REQUIRED'))
  console.warn(message)
}

/** The session the app's jwt.ts verifies (HS256, sub = the user), signed with
 *  node's own HMAC: jose's Uint8Array check fails across jsdom's realm. */
function signSession(secret: string): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'HS256' })}.${b64({ email: 'qa-owner-a@example.test', sub: USER_A, iat: now, exp: now + 3600 })}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

describe.skipIf(!APP_UP)('"New Investigation" at 320, on the harness (Chromium)', () => {
  let browser: Browser
  let token: string

  beforeAll(async () => {
    const { chromium } = await import('playwright')
    browser = await chromium.launch()
    token = signSession(STATE!.jwtSecret)
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
  })

  async function measure(width: number, css?: string) {
    const { interceptSendCode } = await import('../../scripts/qa/browser')
    const context = await browser.newContext({ viewport: { width, height: 640 } })
    await interceptSendCode(context)
    await context.addCookies([
      { name: 'republic_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto(`${APP_URL}/investigations`, { waitUntil: 'networkidle' })
    if (css) await page.addStyleTag({ content: css })
    // The page's own button, not the sidebar's link of the same name.
    const link = page.locator('#main-content').getByRole('link', { name: 'New Investigation' })
    await link.waitFor()
    const result = await link.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const main = document.getElementById('main-content')!.getBoundingClientRect()
      return {
        left: r.left,
        right: r.right,
        mainLeft: main.left,
        mainRight: main.right,
        // The label fits its box: nothing is cut off inside the button.
        overflow: el.scrollWidth - el.clientWidth,
        viewport: window.innerWidth,
      }
    })
    await context.close()
    return result
  }

  for (const width of [320, 375, 1440]) {
    it(`${width}: the button sits whole inside the content column`, async () => {
      const m = await measure(width)
      expect(m.left).toBeGreaterThanOrEqual(m.mainLeft)
      expect(m.right).toBeLessThanOrEqual(m.mainRight)
      expect(m.right).toBeLessThanOrEqual(m.viewport)
      expect(m.overflow).toBe(0)
    }, 60_000)
  }

  it('control, 320: the pre-fix header (no wrap) runs the button past the column, and is caught', async () => {
    // The old header put back as injected CSS: these tests read the harness
    // build, which a source mutation never reaches.
    const m = await measure(320, '#main-content .flex-wrap { flex-wrap: nowrap !important; }')
    expect(m.right > m.mainRight || m.overflow > 0 || m.left < m.mainLeft).toBe(true)
  }, 60_000)
})
