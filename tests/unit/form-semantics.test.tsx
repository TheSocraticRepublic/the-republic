// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

/*
 * Form semantics (UI plan B3b), the three forms rendered for real. Only their
 * network (fetch), the Next router, the pointer media query (`matchMedia`)
 * and the platform the browser reports (`navigator.platform`,
 * `navigator.userAgentData`) are stubbed.
 *
 * Covered: the Votes postal helper as the input's description; the concern
 * form's shortcut hint, worded per platform, hidden on a coarse pointer and
 * referenced by the textarea only while shown; autofocus on a fine pointer
 * only; the Oracle upload zone as the file input's 44px <label>, its copy
 * chosen by CSS pointer media, its errors mapped by status and announced,
 * focus kept through a busy upload; the server
 * snapshots of input-modality and its unsubscribe.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { PostalCodeForm } from '@/components/votes/postal-code-form'
import { ConcernForm } from '@/components/investigation/concern-form'
import { UploadZone } from '@/components/oracle/upload-zone'
import { useCoarsePointer, useModifierKeyLabel } from '@/lib/ui/input-modality'

type ChangeListener = () => void
let coarse: boolean
let pointerListeners: Set<ChangeListener>

/** `(pointer: coarse)` answers `coarse`; every other query answers false. The
 *  query lists support `change` listeners so a test can flip the pointer. */
function stubMatchMedia(initial: boolean) {
  coarse = initial
  pointerListeners = new Set()
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return query === '(pointer: coarse)' && coarse
      },
      addEventListener: (_: string, cb: ChangeListener) => {
        if (query === '(pointer: coarse)') pointerListeners.add(cb)
      },
      removeEventListener: (_: string, cb: ChangeListener) => {
        pointerListeners.delete(cb)
      },
    }))
  )
}

function setPointer(next: boolean) {
  coarse = next
  act(() => {
    for (const cb of pointerListeners) cb()
  })
}

const nav = window.navigator as Navigator & { userAgentData?: unknown }
const realPlatform = Object.getOwnPropertyDescriptor(nav, 'platform')
const realUAData = Object.getOwnPropertyDescriptor(nav, 'userAgentData')

function setPlatform(platform: string, userAgentData?: { platform: string }) {
  Object.defineProperty(nav, 'platform', { configurable: true, get: () => platform })
  Object.defineProperty(nav, 'userAgentData', { configurable: true, get: () => userAgentData })
}

function restorePlatform() {
  if (realPlatform) Object.defineProperty(nav, 'platform', realPlatform)
  else delete (nav as unknown as Record<string, unknown>).platform
  if (realUAData) Object.defineProperty(nav, 'userAgentData', realUAData)
  else delete (nav as unknown as Record<string, unknown>).userAgentData
}

/** The text an element's `aria-describedby` points at, as a screen reader
 *  would read it; `null` when it has no description reference. */
function description(el: Element): string | null {
  const ids = el.getAttribute('aria-describedby')
  if (ids === null) return null
  return ids
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

let ingestCalls: number
type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> }
/** How the stubbed /api/oracle/ingest answers; the default is a success. */
let ingest: () => Promise<FakeResponse>

beforeEach(() => {
  push.mockReset()
  ingestCalls = 0
  ingest = async () => ({ ok: true, status: 200, json: async () => ({ documentId: 'doc-1' }) })
  stubMatchMedia(false)
  setPlatform('Linux x86_64')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const respond = (body: Record<string, unknown>, status = 200) => ({ ok: status < 400, status, json: async () => body })
      if (url === '/api/mirror/jurisdictions') return respond({ jurisdictions: [] })
      if (url === '/api/oracle/ingest') {
        ingestCalls++
        return ingest()
      }
      throw new Error(`unexpected fetch ${url}`)
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  restorePlatform()
})

describe('Votes postal code form', () => {
  it('describes the postal input with the helper that says where the code is sent', () => {
    render(<PostalCodeForm />)
    const input = screen.getByLabelText('Your postal code')
    expect(input.getAttribute('aria-describedby')).toBe('postal-code-helper')
    expect(description(input)).toBe("Sent to Open North's Represent service to find your riding.")
    // Balanced wrapping, so "riding." is never alone on a line at 375.
    expect(document.getElementById('postal-code-helper')?.className.split(/\s+/)).toContain('text-pretty')
  })
})

describe('concern form shortcut hint', () => {
  function textarea() {
    return screen.getByLabelText('Describe your concern') as HTMLTextAreaElement
  }

  it('says Ctrl+Enter on a non-Apple platform, and the textarea is described by it', async () => {
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Ctrl+Enter to start.')).toBeTruthy())
    expect(screen.queryByText(/Cmd\+Enter/)).toBeNull()
    expect(description(textarea())).toBe('Press Ctrl+Enter to start.')
  })

  it('says Cmd+Enter on a Mac', async () => {
    setPlatform('MacIntel')
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Cmd+Enter to start.')).toBeTruthy())
    expect(screen.queryByText(/Ctrl\+Enter/)).toBeNull()
    expect(description(textarea())).toBe('Press Cmd+Enter to start.')
  })

  it('reads the platform from userAgentData first when the browser has it', async () => {
    // userAgentData is the current source; navigator.platform is frozen or
    // reduced in some browsers, so it is consulted only when the first is absent.
    setPlatform('Linux x86_64', { platform: 'macOS' })
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Cmd+Enter to start.')).toBeTruthy())
  })

  it('is not shown on a coarse pointer, and the textarea then has no description reference', async () => {
    stubMatchMedia(true)
    render(<ConcernForm />)
    // The form is up (the disabled-reason line renders with it).
    await waitFor(() => expect(screen.getByText('Describe your concern to start.')).toBeTruthy())
    expect(textarea()).toBeTruthy()
    expect(screen.queryByText(/\+Enter to start/)).toBeNull()
    expect(document.getElementById('concern-hint')).toBeNull()
    expect(textarea().hasAttribute('aria-describedby')).toBe(false)
  })

  it('follows a pointer change: hidden when the pointer turns coarse, back when it turns fine', async () => {
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Ctrl+Enter to start.')).toBeTruthy())
    setPointer(true)
    expect(screen.queryByText('Press Ctrl+Enter to start.')).toBeNull()
    expect(textarea().hasAttribute('aria-describedby')).toBe(false)
    setPointer(false)
    expect(screen.getByText('Press Ctrl+Enter to start.')).toBeTruthy()
    expect(description(textarea())).toBe('Press Ctrl+Enter to start.')
  })
})

describe('concern form autofocus', () => {
  it('focuses the textarea on mount on a fine pointer', async () => {
    render(<ConcernForm />)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Describe your concern')))
  })

  it('focuses nothing on mount on a coarse pointer', async () => {
    stubMatchMedia(true)
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Describe your concern to start.')).toBeTruthy())
    const ta = screen.getByLabelText('Describe your concern')
    expect(document.activeElement).not.toBe(ta)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('Oracle upload zone', () => {
  const LIMITS = 'Government documents only. Max 10 MB.'

  function fileInput() {
    return document.getElementById('oracle-file') as HTMLInputElement
  }

  function classes(el: Element | null) {
    return (el?.getAttribute('class') ?? '').split(/\s+/)
  }

  function pick(name: string, type = 'application/pdf') {
    fireEvent.change(fileInput(), { target: { files: [new File(['%PDF'], name, { type })] } })
  }

  it('is the file input\'s <label>, at least 44px tall (min-h-11), with no other control in the zone', () => {
    render(<UploadZone />)
    const input = fileInput()
    expect(input.type).toBe('file')
    const zone = input.closest('label') as HTMLLabelElement
    expect(zone).not.toBeNull()
    expect(zone.htmlFor).toBe('oracle-file')
    expect(Array.from(input.labels ?? [])).toContain(zone)
    expect(classes(zone)).toContain('min-h-11')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names the input exactly "Choose a PDF" and describes it with the limits (WCAG 2.5.3)', () => {
    render(<UploadZone />)
    const input = fileInput()
    expect(input.getAttribute('aria-label')).toBe('Choose a PDF')
    expect(input.getAttribute('aria-describedby')).toBe('oracle-file-limits')
    expect(description(input)).toBe(LIMITS)
  })

  it('every pointer\'s action line begins with the name; the copy is chosen by CSS, right in the server render', () => {
    // The pointer stub is coarse, and must not matter: the copy is not scripted.
    stubMatchMedia(true)
    const host = document.createElement('div')
    host.innerHTML = renderToString(<UploadZone />)
    const fine = host.querySelector('[data-pointer-copy="fine"]')
    const coarseCopy = host.querySelector('[data-pointer-copy="coarse"]')
    expect(fine?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Choose a PDF or drop one here')
    expect(coarseCopy?.textContent?.trim()).toBe('Choose a PDF')
    expect(classes(fine)).toContain('pointer-coarse:hidden')
    expect(classes(fine)).not.toContain('hidden')
    expect(classes(coarseCopy)).toContain('hidden')
    expect(classes(coarseCopy)).toContain('pointer-coarse:block')
    expect(fine?.closest('label')?.getAttribute('for')).toBe('oracle-file')
    expect(coarseCopy?.closest('label')?.getAttribute('for')).toBe('oracle-file')
    expect(host.querySelector('#oracle-file-limits')?.textContent?.trim()).toBe(LIMITS)
  })

  it('a tap anywhere on the zone reaches the file input', () => {
    render(<UploadZone />)
    let opened = 0
    fileInput().addEventListener('click', () => opened++)
    fireEvent.click(screen.getByText('or drop one here', { exact: false }))
    expect(opened).toBe(1)
    fireEvent.click(screen.getByText(LIMITS))
    expect(opened).toBe(2)
  })

  it('a refused file: the error is announced above the zone\'s own copy, describes the input, and keeps focus', () => {
    render(<UploadZone />)
    const input = fileInput()
    input.focus()
    pick('notes.txt', 'text/plain')

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe("That file isn't a PDF.")
    expect(alert.id).toBe('oracle-file-error')
    // The instructions are still there, below the error.
    const fine = document.querySelector('[data-pointer-copy="fine"]')!
    expect(fine.textContent?.replace(/\s+/g, ' ').trim()).toBe('Choose a PDF or drop one here')
    expect(alert.compareDocumentPosition(fine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // ... and shown, not merely present: no hidden attribute, no hiding class
    // beyond the coarse-pointer one.
    expect(fine.hasAttribute('hidden')).toBe(false)
    expect((fine.getAttribute('class') ?? '').split(/\s+/)).not.toContain('hidden')
    expect((fine.getAttribute('class') ?? '').split(/\s+/)).toContain('pointer-coarse:hidden')
    expect(input.getAttribute('aria-describedby')).toBe('oracle-file-error oracle-file-limits')
    expect(description(input)).toBe(`That file isn't a PDF. ${LIMITS}`)
    // No retry button: the zone is the retry, and it is the only control.
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.activeElement).toBe(input)

    // The same refusal again is a new alert, so it is announced again.
    pick('notes.txt', 'text/plain')
    const again = screen.getByRole('alert')
    expect(again.textContent).toBe("That file isn't a PDF.")
    expect(again).not.toBe(alert)
  })

  it('a PDF over 10 MB is refused before any request', () => {
    render(<UploadZone />)
    const big = new File(['%PDF'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(fileInput(), { target: { files: [big] } })
    expect(screen.getByRole('alert').textContent).toBe('That PDF is over 10 MB.')
    expect(ingestCalls).toBe(0)
  })

  it('clears the input after reading a file, so the same file can be chosen again', () => {
    render(<UploadZone />)
    const input = fileInput()
    const written: string[] = []
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (v: string) => {
        written.push(v)
      },
    })
    pick('notes.txt', 'text/plain')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(written).toEqual([''])
  })

  const SERVER_TEXT = 'SERVER-SAID-THIS'
  const cases: Array<[string, () => Promise<FakeResponse>, string]> = [
    ['400', async () => ({ ok: false, status: 400, json: async () => ({ error: SERVER_TEXT }) }), "Open Cave couldn't receive that file. Choose it again."],
    ['413', async () => ({ ok: false, status: 413, json: async () => ({ error: SERVER_TEXT }) }), 'That PDF is over 10 MB.'],
    ['429', async () => ({ ok: false, status: 429, json: async () => ({ error: SERVER_TEXT }) }), 'Too many uploads in the last minute. Wait a minute, then choose the PDF again.'],
    ['500', async () => ({ ok: false, status: 500, json: async () => ({ error: SERVER_TEXT }) }), "Open Cave couldn't process that PDF. Choose it again, or choose another."],
    [
      'an HTML 502',
      async () => ({ ok: false, status: 502, json: async () => JSON.parse('<!DOCTYPE html>') }),
      "Open Cave couldn't upload that PDF. Choose it again.",
    ],
    [
      'a 200 with no documentId',
      async () => ({ ok: true, status: 200, json: async () => ({ error: SERVER_TEXT }) }),
      "Open Cave couldn't upload that PDF. Choose it again.",
    ],
    [
      'offline (fetch throws)',
      async () => {
        throw new TypeError('Failed to fetch')
      },
      "Open Cave can't be reached. Check your connection, then choose the PDF again.",
    ],
  ]

  for (const [label, respond, copy] of cases) {
    it(`${label}: shows "${copy}" and no server or browser text`, async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      ingest = respond
      render(<UploadZone />)
      pick('bylaw.pdf')
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(copy))
      const text = document.body.textContent ?? ''
      expect(text).not.toContain(SERVER_TEXT)
      expect(text).not.toMatch(/Failed to fetch|DOCTYPE|JSON|Unexpected token/)
      expect(push).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  }

  it('a 401 goes to login and back to the Oracle, with no message', async () => {
    ingest = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) })
    render(<UploadZone />)
    pick('bylaw.pdf')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?redirect=%2Foracle'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.body.textContent).not.toContain('Unauthorized')
  })

  it('while uploading: aria-disabled not disabled, focus stays, a press opens no picker and a pick starts no second upload', async () => {
    let finish!: (r: FakeResponse) => void
    ingest = () => new Promise<FakeResponse>((resolve) => (finish = resolve))
    render(<UploadZone />)
    const input = fileInput()
    input.focus()
    pick('bylaw.pdf')

    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Uploading…'))
    expect(input.getAttribute('aria-disabled')).toBe('true')
    expect(input.disabled).toBe(false)
    expect(document.activeElement).toBe(input)
    // fireEvent returns false when the default (opening the picker) was prevented.
    expect(fireEvent.click(input)).toBe(false)
    pick('second.pdf')
    expect(ingestCalls).toBe(1)

    await act(async () => {
      finish({ ok: false, status: 500, json: async () => ({ error: SERVER_TEXT }) })
    })
    expect(screen.getByRole('alert').textContent).toBe("Open Cave couldn't process that PDF. Choose it again, or choose another.")
    expect(input.hasAttribute('aria-disabled')).toBe(false)
    expect(document.activeElement).toBe(input)
    // Not busy any more: a press opens the picker again.
    expect(fireEvent.click(input)).toBe(true)
  })

  it('a PDF chosen through the zone uploads and opens its page', async () => {
    render(<UploadZone />)
    pick('bylaw.pdf')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/oracle/doc-1'))
    expect(ingestCalls).toBe(1)
  })
})

describe('input-modality on the server and on unmount', () => {
  function Probe() {
    const coarsePointer = useCoarsePointer()
    const key = useModifierKeyLabel()
    return <span data-probe="">{`${coarsePointer}|${key}`}</span>
  }

  it('server snapshots: a fine pointer and no platform, whatever the browser would say', () => {
    stubMatchMedia(true)
    setPlatform('MacIntel')
    expect(renderToString(<Probe />)).toContain('false|null')
    // The client reads the real values (the positive sibling).
    render(<Probe />)
    expect(screen.getByText('true|Cmd')).toBeTruthy()
  })

  it('the concern form server-renders no shortcut hint and no description reference', () => {
    setPlatform('MacIntel')
    const html = renderToString(<ConcernForm />)
    expect(html).toContain('aria-label="Describe your concern"')
    expect(html).not.toContain('+Enter to start')
    expect(html).not.toContain('concern-hint')
  })

  it('stops listening for pointer changes on unmount', () => {
    const { unmount } = render(<Probe />)
    expect(pointerListeners.size).toBeGreaterThan(0)
    unmount()
    expect(pointerListeners.size).toBe(0)
  })
})
