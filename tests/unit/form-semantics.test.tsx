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
 * chosen by CSS pointer media, "Try again" outside the label; the server
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

beforeEach(() => {
  push.mockReset()
  ingestCalls = 0
  stubMatchMedia(false)
  setPlatform('Linux x86_64')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const respond = (body: Record<string, unknown>, status = 200) => ({ ok: status < 400, status, json: async () => body })
      if (url === '/api/mirror/jurisdictions') return respond({ jurisdictions: [] })
      if (url === '/api/oracle/ingest') {
        ingestCalls++
        return respond({ documentId: 'doc-1' })
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
    expect(description(input)).toBe("Sent to Open North's Represent API to find your riding.")
  })
})

describe('concern form shortcut hint', () => {
  function textarea() {
    return screen.getByLabelText('Describe your concern') as HTMLTextAreaElement
  }

  it('says Ctrl+Enter on a non-Apple platform, and the textarea is described by it', async () => {
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Ctrl+Enter to start')).toBeTruthy())
    expect(screen.queryByText(/Cmd\+Enter/)).toBeNull()
    expect(description(textarea())).toBe('Press Ctrl+Enter to start')
  })

  it('says Cmd+Enter on a Mac', async () => {
    setPlatform('MacIntel')
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Cmd+Enter to start')).toBeTruthy())
    expect(screen.queryByText(/Ctrl\+Enter/)).toBeNull()
    expect(description(textarea())).toBe('Press Cmd+Enter to start')
  })

  it('reads the platform from userAgentData first when the browser has it', async () => {
    // userAgentData is the current source; navigator.platform is frozen or
    // reduced in some browsers, so it is consulted only when the first is absent.
    setPlatform('Linux x86_64', { platform: 'macOS' })
    render(<ConcernForm />)
    await waitFor(() => expect(screen.getByText('Press Cmd+Enter to start')).toBeTruthy())
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
    await waitFor(() => expect(screen.getByText('Press Ctrl+Enter to start')).toBeTruthy())
    setPointer(true)
    expect(screen.queryByText('Press Ctrl+Enter to start')).toBeNull()
    expect(textarea().hasAttribute('aria-describedby')).toBe(false)
    setPointer(false)
    expect(screen.getByText('Press Ctrl+Enter to start')).toBeTruthy()
    expect(description(textarea())).toBe('Press Ctrl+Enter to start')
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
  const NAME = 'Choose a PDF, government documents only, 10 MB maximum'

  function fileInput() {
    return screen.getByLabelText(NAME) as HTMLInputElement
  }

  function classes(el: Element | null) {
    return (el?.getAttribute('class') ?? '').split(/\s+/)
  }

  it('is the named file input\'s <label>, at least 44px tall (min-h-11)', () => {
    render(<UploadZone />)
    const input = fileInput()
    expect(input.type).toBe('file')
    expect(input.id).toBe('oracle-file')
    const zone = input.closest('label') as HTMLLabelElement
    expect(zone).not.toBeNull()
    expect(zone.htmlFor).toBe('oracle-file')
    expect(Array.from(input.labels ?? [])).toContain(zone)
    expect(classes(zone)).toContain('min-h-11')
    // The old inline "browse" button is gone: the zone is the one control.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('names the input with the coarse-pointer copy first (WCAG 2.5.3, label in name)', () => {
    render(<UploadZone />)
    const input = fileInput()
    expect(input.getAttribute('aria-label')?.startsWith('Choose a PDF')).toBe(true)
  })

  it('chooses its copy by CSS pointer media, so the server render is right on both pointers', () => {
    // The pointer stub is coarse, and must not matter: the copy is not scripted.
    stubMatchMedia(true)
    const html = renderToString(<UploadZone />)
    const host = document.createElement('div')
    host.innerHTML = html
    const fine = host.querySelector('[data-pointer-copy="fine"]')
    const coarseCopy = host.querySelector('[data-pointer-copy="coarse"]')
    expect(fine?.textContent).toMatch(/^Drop a PDF here or\s*browse$/)
    expect(coarseCopy?.textContent).toBe('Choose a PDF')
    // Fine copy hidden on a coarse pointer; coarse copy hidden unless coarse.
    expect(classes(fine)).toContain('pointer-coarse:hidden')
    expect(classes(fine)).not.toContain('hidden')
    expect(classes(coarseCopy)).toContain('hidden')
    expect(classes(coarseCopy)).toContain('pointer-coarse:block')
    // Both copies sit inside the label, so a tap on either opens the picker.
    expect(fine?.closest('label')?.getAttribute('for')).toBe('oracle-file')
    expect(coarseCopy?.closest('label')?.getAttribute('for')).toBe('oracle-file')
  })

  it('a tap anywhere on the zone reaches the file input', () => {
    render(<UploadZone />)
    let opened = 0
    fileInput().addEventListener('click', () => opened++)
    fireEvent.click(screen.getByText('Choose a PDF'))
    expect(opened).toBe(1)
    fireEvent.click(screen.getByText('Government documents only. Max 10MB.'))
    expect(opened).toBe(2)
  })

  it('"Try again" sits beside the label, never inside it, and returns focus to the input', () => {
    render(<UploadZone />)
    const input = fileInput()
    let opened = 0
    input.addEventListener('click', () => opened++)
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })
    expect(screen.getByText('Only PDF files are accepted.')).toBeTruthy()

    const button = screen.getByRole('button', { name: 'Try again' })
    const label = input.closest('label') as HTMLLabelElement
    // Not a descendant of the label (an engine that checks the click target
    // after React unmounts it would forward the click to the input) ...
    expect(label.contains(button)).toBe(false)
    expect(button.closest('label')).toBeNull()
    // ... but still in the zone's box, beside the label.
    expect(label.parentElement?.contains(button)).toBe(true)

    fireEvent.click(button)
    expect(opened).toBe(0)
    expect(screen.getByText(/Drop a PDF here or/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(document.activeElement).toBe(input)
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
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } })
    expect(screen.getByText('Only PDF files are accepted.')).toBeTruthy()
    expect(written).toEqual([''])
  })

  it('a file chosen through the zone uploads', async () => {
    render(<UploadZone />)
    fireEvent.change(fileInput(), { target: { files: [new File(['%PDF'], 'bylaw.pdf', { type: 'application/pdf' })] } })
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
