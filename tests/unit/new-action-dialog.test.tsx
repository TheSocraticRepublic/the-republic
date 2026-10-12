// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

/*
 * The new-action dialog (A2): the province select, the body select, and the
 * double-click guard. The component is rendered for real; only its network
 * (fetch) and the Next router are stubbed.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { NewActionDialog } from '@/components/lever/new-action-dialog'

type Json = Record<string, unknown>

interface FetchPlan {
  investigation: Json | Promise<Json>
  create?: Promise<Json>
}

let createCalls: Array<Json>

function installFetch(plan: FetchPlan) {
  createCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const respond = (body: Json, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })
      if (url === '/api/oracle/documents') return respond({ documents: [] })
      if (url === '/api/gadfly/session') return respond({ sessions: [] })
      if (url.startsWith('/api/investigate/')) return respond(await plan.investigation)
      if (url === '/api/lever/actions' && init?.method === 'POST') {
        createCalls.push(JSON.parse(String(init.body)))
        return respond(await (plan.create ?? Promise.resolve({ actionId: 'new-action-id' })))
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
    expect(
      screen.getByText(
        "Detected from your investigation. Change it if it is wrong. This province's legal citations are not verified yet. Confirm them before you file."
      )
    ).toBeTruthy()
  })

  it('a double click sends one create', async () => {
    const create = deferred<Json>()
    installFetch({ investigation: BC_INVESTIGATION, create: create.promise })
    openFromInvestigation()
    await waitFor(() => expect(provinceSelect().value).toBe('bc'))
    fireEvent.change(screen.getByLabelText('What records do you want?'), { target: { value: 'Records.' } })
    const generate = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement
    expect(generate.disabled).toBe(false)
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
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true)
    expect(bodySelect().disabled).toBe(true)
  })
})
