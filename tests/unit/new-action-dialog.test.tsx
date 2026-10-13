// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

/*
 * The new-action dialog (A2): the province select, the body select, and the
 * double-click guard. The component is rendered for real; only its network
 * (fetch) and the Next router are stubbed.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))

import { NewActionDialog } from '@/components/lever/new-action-dialog'

type Json = Record<string, unknown>

interface FetchPlan {
  investigation: Json | Promise<Json>
  /** The create response body (200), or { status, body } for a failure. */
  create?: Promise<Json | { status: number; body: Json }>
}

let createCalls: Array<Json>

function installFetch(plan: FetchPlan) {
  createCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const respond = (body: Json, status = 200) => ({ ok: status < 400, status, json: async () => body })
      if (url === '/api/oracle/documents') return respond({ documents: [] })
      if (url === '/api/gadfly/session') return respond({ sessions: [] })
      if (url.startsWith('/api/investigate/')) return respond(await plan.investigation)
      if (url === '/api/lever/actions' && init?.method === 'POST') {
        createCalls.push(JSON.parse(String(init.body)))
        const created = (await (plan.create ?? Promise.resolve({ actionId: 'new-action-id' }))) as Json
        if (typeof created.status === 'number' && created.body) return respond(created.body as Json, created.status)
        return respond(created)
      }
      if (url === '/api/lever/actions') return respond({ actions: [] })
      throw new Error(`unexpected fetch ${url}`)
    })
  )
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const BC_INVESTIGATION = {
  investigation: { concern: 'Synthetic', jurisdictionName: 'City of Burnaby', jurisdictionProvince: 'British Columbia' },
}

const provinceSelect = () => screen.getByLabelText('Province') as HTMLSelectElement
const bodySelect = () => document.getElementById('action-public-body') as HTMLSelectElement

function openFromInvestigation() {
  render(<NewActionDialog initialInvestigationId="inv-1" initialActionType="fippa_request" />)
}

beforeEach(() => push.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewActionDialog', () => {
  it('pre-selects the investigation’s resolved province (Burnaby has no detection keyword)', async () => {
    installFetch({ investigation: BC_INVESTIGATION })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    expect(screen.getByText('Detected from your investigation. Change it if it is wrong.')).toBeTruthy()
  })

  it('a detected AB or ON province shows the "not verified" hint too', async () => {
    installFetch({
      investigation: { investigation: { concern: 'x', jurisdictionName: 'Synthetic County', jurisdictionProvince: 'Alberta' } },
    })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('ab'))
    // The caveat leads, on its own line, at 12px secondary; the detection note follows.
    const caveat = screen.getByText(
      "Open Cave has not verified Alberta's legal citations yet. Check each one against the Act before you file."
    )
    expect(caveat.className).toContain('text-xs')
    expect(caveat.className).toContain('text-text-secondary')
    expect(caveat.className).not.toContain('danger')
    const hint = caveat.parentElement!
    expect(hint.firstElementChild).toBe(caveat)
    expect(hint.textContent).toContain('Detected from your investigation. Change it if it is wrong.')
  })

  it('a double click sends one create', async () => {
    const create = deferred<Json>()
    installFetch({ investigation: BC_INVESTIGATION, create: create.promise })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement
    expect(generate.getAttribute('aria-disabled')).toBe('false')
    // Both clicks inside one act: React has not re-rendered the button as
    // disabled between them, so only the synchronous guard can stop the second.
    act(() => {
      generate.click()
      generate.click()
    })
    await waitFor(() => expect(createCalls).toHaveLength(1))
    create.resolve({ actionId: 'new-action-id' })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/lever/new-action-id'))
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]).toMatchObject({ actionType: 'fippa_request', jurisdiction: 'bc', investigationId: 'inv-1' })
  })

  it('a province change clears the chosen body', async () => {
    installFetch({ investigation: BC_INVESTIGATION })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(bodySelect(), { target: { value: 'BC Ministry of Forests' } })
    expect(bodySelect().value).toBe('BC Ministry of Forests')
    fireEvent.change(provinceSelect(), { target: { value: 'ab' } })
    expect(provinceSelect().value).toBe('ab')
    expect(bodySelect().value).toBe('')
    expect([...bodySelect().options].map((o) => o.text)).toContain('City of Edmonton')
    // The choice itself is cleared, not just hidden by the new option list:
    // switching back does not bring it back.
    fireEvent.change(provinceSelect(), { target: { value: 'bc' } })
    expect(bodySelect().value).toBe('')
  })

  it('a late detection never overrides a province the citizen chose', async () => {
    const investigation = deferred<Json>()
    installFetch({ investigation: investigation.promise })
    openFromInvestigation()
    const select = await waitFor(() => provinceSelect())
    expect(select.value).toBe('')
    fireEvent.change(select, { target: { value: 'on' } })
    await act(async () => {
      investigation.resolve(BC_INVESTIGATION)
      await investigation.promise
    })
    // let the dialog's Promise.all settle
    await waitFor(() => expect(screen.queryAllByText('No document').length).toBeGreaterThan(0))
    expect(provinceSelect().value).toBe('on')
  })

  it('an untouched select does take the late detection', async () => {
    const investigation = deferred<Json>()
    installFetch({ investigation: investigation.promise })
    openFromInvestigation()
    await waitFor(() => provinceSelect())
    await act(async () => {
      investigation.resolve(BC_INVESTIGATION)
      await investigation.promise
    })
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
  })

  it('with no province, Generate stays disabled and the body select waits', async () => {
    installFetch({ investigation: { investigation: { concern: 'x', jurisdictionName: 'Nowhere', jurisdictionProvince: null } } })
    openFromInvestigation()
    await waitFor(() => expect(screen.getByText('Choose the province this request goes to.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement
    expect(generate.getAttribute('aria-disabled')).toBe('true')
    expect(bodySelect().disabled).toBe(true)
  })

  it('names why Generate is unavailable, keeps it focusable, and sends focus to the province instead of sending', async () => {
    installFetch({ investigation: { investigation: { concern: 'x', jurisdictionName: 'Nowhere', jurisdictionProvince: null } } })
    openFromInvestigation()
    await waitFor(() => expect(screen.getByText('Choose the province this request goes to.')).toBeTruthy())
    expect(screen.queryByText('Choose a province to generate this request.')).toBeNull()
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    const reason = screen.getByText('Choose a province to generate this request.')
    expect(reason.className).not.toContain('danger')
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement
    expect(generate.disabled).toBe(false) // in the tab order
    expect(generate.getAttribute('aria-describedby')).toBe(reason.id)
    generate.focus()
    fireEvent.click(generate)
    await waitFor(() => expect(document.activeElement).toBe(provinceSelect()))
    expect(createCalls).toHaveLength(0)
    fireEvent.change(provinceSelect(), { target: { value: 'bc' } })
    expect(screen.queryByText('Choose a province to generate this request.')).toBeNull()
  })

  it('while a create is pending, Generate is aria-busy and aria-disabled, never disabled, and keeps focus', async () => {
    const create = deferred<Json>()
    installFetch({ investigation: BC_INVESTIGATION, create: create.promise })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement
    generate.focus()
    fireEvent.click(generate)
    const busy = await screen.findByRole('button', { name: 'Creating...' })
    expect(busy).toBe(generate)
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect((busy as HTMLButtonElement).disabled).toBe(false)
    expect(busy.className).not.toContain('opacity-40')
    expect(document.activeElement).toBe(busy)
    fireEvent.click(busy)
    expect(createCalls).toHaveLength(1)
    await act(async () => {
      create.resolve({ actionId: 'new-action-id' })
      await create.promise
    })
  })

  it("shows the server's field refusal under the public body, focuses it, and clears it on edit", async () => {
    const message = 'That body is in the British Columbia directory. Choose British Columbia, or pick a body from the list.'
    installFetch({
      investigation: BC_INVESTIGATION,
      create: Promise.resolve({ status: 400, body: { error: message, field: 'publicBody' } }),
    })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(provinceSelect(), { target: { value: 'ab' } })
    fireEvent.change(bodySelect(), { target: { value: '__other__' } })
    const other = screen.getByLabelText('Public body name') as HTMLInputElement
    fireEvent.change(other, { target: { value: 'BC Ministry of Forests' } })
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    const error = await screen.findByText(message)
    expect(error.className).toContain('text-status-danger')
    expect(other.getAttribute('aria-invalid')).toBe('true')
    expect(other.getAttribute('aria-describedby')).toBe(error.id)
    await waitFor(() => expect(document.activeElement).toBe(other))
    expect(screen.queryByText('Failed to create action. Try again.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.change(other, { target: { value: 'Synthetic Water Board' } })
    expect(screen.queryByText(message)).toBeNull()
    expect(other.getAttribute('aria-invalid')).toBeNull()
  })

  it('a field refusal also clears when the province changes', async () => {
    const message = 'That body is in the British Columbia directory. Choose British Columbia, or pick a body from the list.'
    installFetch({
      investigation: BC_INVESTIGATION,
      create: Promise.resolve({ status: 400, body: { error: message, field: 'publicBody' } }),
    })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(bodySelect(), { target: { value: 'BC Ministry of Forests' } })
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await screen.findByText(message)
    await waitFor(() => expect(document.activeElement).toBe(bodySelect()))
    expect(bodySelect().getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(provinceSelect(), { target: { value: 'on' } })
    expect(screen.queryByText(message)).toBeNull()
  })

  it("shows any other 4xx's own message in the footer alert and focuses it; a 5xx stays generic", async () => {
    installFetch({
      investigation: BC_INVESTIGATION,
      create: Promise.resolve({ status: 400, body: { error: 'Choose the province this request goes to' } }),
    })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Choose the province this request goes to')
    await waitFor(() => expect(document.activeElement).toBe(alert))
    cleanup()

    installFetch({ investigation: BC_INVESTIGATION, create: Promise.resolve({ status: 500, body: { error: 'Internal server error' } }) })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Failed to create action. Try again.')
  })

  it('a province change clears a typed "Other" name too', async () => {
    installFetch({ investigation: BC_INVESTIGATION })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(bodySelect(), { target: { value: '__other__' } })
    fireEvent.change(screen.getByLabelText('Public body name'), { target: { value: 'Synthetic typed body' } })
    fireEvent.change(provinceSelect(), { target: { value: 'on' } })
    expect(screen.queryByLabelText('Public body name')).toBeNull()
    fireEvent.change(bodySelect(), { target: { value: '__other__' } })
    expect((screen.getByLabelText('Public body name') as HTMLInputElement).value).toBe('')
  })
})
