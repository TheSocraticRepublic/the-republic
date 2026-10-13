// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/*
 * The login page (UI plan B3a), rendered for real. Only its network (fetch)
 * and the browser's navigation (`window.location`) are stubbed: jsdom does
 * not navigate, so `location` is replaced with an object carrying the real
 * origin, the test's query string and a recording `assign`.
 *
 * Covered: `?redirect=` through safeRedirectTarget and `location.assign` of
 * the absolute result; the Enter handler (path 3 of the disabled-actions
 * list) checking the same `canSubmit` predicate as the button; `<main>`;
 * no autofocus on a coarse pointer; errors without "Please".
 */

const ORIGIN = 'http://127.0.0.1:3177'
const FALLBACK = `${ORIGIN}/investigate`

import LoginPage from '@/app/(auth)/login/page'

let assign: ReturnType<typeof vi.fn>
let sendCodeCalls: number
let verifyCalls: number
let verifyResponse: { status: number; body: Record<string, unknown> }
let sendResponse: { status: number; body: Record<string, unknown> }
let sendBodies: Array<Record<string, unknown>>
/** When set, fetch to this route rejects, as a browser does offline. */
let offline: string | null
let holdVerify: Promise<void> | null
const realLocation = window.location

function setLocation(search: string) {
  assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: ORIGIN, href: `${ORIGIN}/login${search}`, pathname: '/login', search, assign },
  })
}

function stubMatchMedia(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: coarse && query === '(pointer: coarse)', media: query }))
  )
}

beforeEach(() => {
  sendCodeCalls = 0
  verifyCalls = 0
  verifyResponse = { status: 200, body: { success: true } }
  sendResponse = { status: 200, body: { ok: true } }
  sendBodies = []
  offline = null
  holdVerify = null
  setLocation('')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const respond = (body: Record<string, unknown>, status = 200) => ({ ok: status < 400, status, json: async () => body })
      if (url === offline) throw new TypeError('Failed to fetch')
      if (url === '/api/auth/send-code' && init?.method === 'POST') {
        sendCodeCalls++
        sendBodies.push(JSON.parse(String(init.body)))
        return respond(sendResponse.body, sendResponse.status)
      }
      if (url === '/api/auth/verify-code' && init?.method === 'POST') {
        verifyCalls++
        if (holdVerify) await holdVerify
        return respond(verifyResponse.body, verifyResponse.status)
      }
      throw new Error(`unexpected fetch ${url}`)
    })
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
})

async function renderLogin() {
  await act(async () => {
    render(createElement(LoginPage))
  })
  return screen.getByLabelText('Email address')
}

async function enter(el: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(el, { key: 'Enter' })
  })
}

async function toCodeStep() {
  const email = await renderLogin()
  fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
  await enter(email)
  expect(sendCodeCalls).toBe(1)
  return screen.getByLabelText('8-digit code')
}

async function signIn() {
  const code = await toCodeStep()
  fireEvent.change(code, { target: { value: '12345678' } })
  await enter(code)
  return code
}

describe('login: redirect after verify-code', () => {
  it('?redirect=/votes assigns the absolute /votes URL on this origin', async () => {
    setLocation('?redirect=%2Fvotes')
    await signIn()
    expect(verifyCalls).toBe(1)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(`${ORIGIN}/votes`)
  })

  it('no ?redirect= assigns /investigate', async () => {
    await signIn()
    expect(assign).toHaveBeenCalledWith(FALLBACK)
  })

  it.each(['/%5Cevil.example', '/\\evil.example', 'https://evil.example', '//evil.example'])(
    'refused %s assigns /investigate',
    async (raw) => {
      setLocation(`?redirect=${encodeURIComponent(raw)}`)
      await signIn()
      expect(assign).toHaveBeenCalledWith(FALLBACK)
    }
  )

  it.each(['/.//evil.example', '/a/..//evil.example', '/%2e//evil.example'])(
    '%s (normalises to a "//" path) assigns /investigate',
    async (raw) => {
      setLocation(`?redirect=${encodeURIComponent(raw)}`)
      await signIn()
      expect(assign).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith(FALLBACK)
    }
  )

  it('a failed verify does not navigate', async () => {
    verifyResponse = { status: 401, body: { error: 'invalid' } }
    setLocation('?redirect=%2Fvotes')
    await signIn()
    expect(assign).not.toHaveBeenCalled()
  })
})

describe('login: Enter handler checks canSubmit (path 3)', () => {
  it('Enter with an empty email dispatches nothing; the button is disabled', async () => {
    const email = await renderLogin()
    await enter(email)
    expect(sendCodeCalls).toBe(0)
    const button = screen.getByRole('button', { name: 'Send code' }) as HTMLButtonElement
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.disabled).toBe(false)
  })

  it('clicking the aria-disabled Send code dispatches nothing', async () => {
    await renderLogin()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    })
    expect(sendCodeCalls).toBe(0)
  })

  it('Enter with a whitespace-only email dispatches nothing', async () => {
    const email = await renderLogin()
    fireEvent.change(email, { target: { value: '   ' } })
    await enter(email)
    expect(sendCodeCalls).toBe(0)
  })

  // type=email sanitisation strips ASCII whitespace only; these survive into
  // the value (a paste), and only `.trim()` in canSubmit stops the dispatch
  // (Razor W1).
  it.each([
    ['NBSP', '\u00A0'],
    ['ideographic space', '\u3000'],
    ['BOM / ZWNBSP', '\uFEFF'],
    ['narrow NBSP', '\u202F'],
  ])('Enter, and the button, with a lone %s dispatch nothing', async (_name, ch) => {
    const email = (await renderLogin()) as HTMLInputElement
    fireEvent.change(email, { target: { value: ch } })
    expect(email.value).toBe(ch)
    await enter(email)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
    })
    expect(sendCodeCalls).toBe(0)
  })

  it('Enter with an email dispatches send-code once', async () => {
    await toCodeStep()
    expect(sendCodeCalls).toBe(1)
  })

  it('Enter with a 7-digit code dispatches nothing; the button is disabled', async () => {
    const code = await toCodeStep()
    fireEvent.change(code, { target: { value: '1234567' } })
    await enter(code)
    expect(verifyCalls).toBe(0)
    const button = screen.getByRole('button', { name: 'Verify code' }) as HTMLButtonElement
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(button)
    })
    expect(verifyCalls).toBe(0)
  })

  it('a second Enter while verify-code is in flight dispatches nothing', async () => {
    let release!: () => void
    holdVerify = new Promise<void>((resolve) => {
      release = resolve
    })
    const code = await signIn()
    expect(verifyCalls).toBe(1)
    await enter(code)
    expect(verifyCalls).toBe(1)
    await act(async () => {
      release()
    })
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('a second Enter on the email while send-code is in flight dispatches nothing', async () => {
    const email = await renderLogin()
    let releaseSend!: () => void
    const held = new Promise<void>((resolve) => {
      releaseSend = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        sendCodeCalls++
        await held
        return { ok: true, status: 200, json: async () => ({}) }
      })
    )
    fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
    await enter(email)
    await enter(email)
    expect(sendCodeCalls).toBe(1)
    await act(async () => {
      releaseSend()
    })
  })
})

describe('login: landmark, focus, error copy', () => {
  it('renders inside <main>', async () => {
    const email = await renderLogin()
    const main = screen.getByRole('main')
    expect(main.tagName).toBe('MAIN')
    expect(main.contains(email)).toBe(true)
  })

  it('focuses the email input on a fine pointer', async () => {
    stubMatchMedia(false)
    const email = await renderLogin()
    expect(document.activeElement).toBe(email)
  })

  it('does not focus the email input on a coarse pointer', async () => {
    stubMatchMedia(true)
    const email = await renderLogin()
    expect(document.activeElement).not.toBe(email)
    expect(document.activeElement).toBe(document.body)
  })

  it('focuses the code input on a fine pointer', async () => {
    stubMatchMedia(false)
    const code = await toCodeStep()
    expect(document.activeElement).toBe(code)
  })

  it('does not focus the code input on a coarse pointer; focus moves to the instruction text', async () => {
    stubMatchMedia(true)
    const code = await toCodeStep()
    expect(document.activeElement).not.toBe(code)
    const active = document.activeElement as HTMLElement
    expect(active).not.toBe(document.body)
    expect(active.tagName).toBe('P')
    expect(active.textContent).toBe('Code sent to qa-owner-a@example.test')
    expect(active.tabIndex).toBe(-1)
  })

  it('on a fine pointer the code step focuses the input, not the instruction text', async () => {
    stubMatchMedia(false)
    const code = await toCodeStep()
    expect(document.activeElement).toBe(code)
    expect(screen.getByText('Code sent to qa-owner-a@example.test')).not.toBe(document.activeElement)
  })

  it('nothing on the page says "Please"', async () => {
    verifyResponse = { status: 401, body: { error: 'invalid' } }
    await signIn()
    expect(document.body.textContent).toContain("That code didn't work.")
    expect(document.body.textContent).not.toMatch(/please/i)
  })
})

/* Jen C5: the copy table, exactly. Raw server or browser strings never reach the page. */
const RAW_STRINGS = ['Failed to fetch', 'Internal server error', 'Invalid email address', 'Too many requests.', 'Too many codes requested']

function expectAlert(expected: string) {
  const alert = screen.getByRole('alert')
  expect(alert.textContent).toBe(expected)
  for (const raw of RAW_STRINGS.filter((r) => !expected.includes(r))) expect(alert.textContent).not.toContain(raw)
}

describe('login: error copy (Jen C5)', () => {
  it.each([
    [401, { error: 'invalid' }, "That code didn't work. Check the 8 digits, or send a new code."],
    [401, { error: 'expired' }, "That code didn't work. Check the 8 digits, or send a new code."],
    [401, { error: 'too_many_attempts' }, 'Too many wrong codes. Send a new code.'],
    [429, { error: 'Too many requests' }, 'Too many tries from this connection. Wait a minute, then try again.'],
    [500, { error: 'Internal server error' }, "Open Cave couldn't check that code. Try again."],
    [400, { error: 'Email and code are required' }, "Open Cave couldn't check that code. Try again."],
  ])('verify %i %j shows the table copy', async (status, body, expected) => {
    verifyResponse = { status, body }
    await signIn()
    expectAlert(expected)
    expect(assign).not.toHaveBeenCalled()
  })

  it.each([
    [400, { error: 'Invalid email address' }, "That isn't a valid email address. Check it and try again."],
    [429, { error: 'Too many codes requested. Try again later.' }, 'Too many codes for this email in the last hour. Try again in an hour.'],
    [429, { error: 'Too many requests. Wait before requesting another code.' }, 'Too many requests. Wait a few minutes, then try again.'],
    [500, { error: 'Internal server error' }, "Open Cave couldn't send a code. Try again."],
  ])('send %i %j shows the table copy and stays on the email step', async (status, body, expected) => {
    sendResponse = { status, body }
    const email = await renderLogin()
    fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
    await enter(email)
    expectAlert(expected)
    expect(screen.getByLabelText('Email address')).toBeTruthy()
  })

  it('offline on send shows the connection copy, not "Failed to fetch"', async () => {
    offline = '/api/auth/send-code'
    const email = await renderLogin()
    fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
    await enter(email)
    expectAlert("Open Cave can't be reached. Check your connection, then try again.")
  })

  it('offline on verify shows the connection copy, not "Failed to fetch"', async () => {
    offline = '/api/auth/verify-code'
    await signIn()
    expectAlert("Open Cave can't be reached. Check your connection, then try again.")
  })
})

describe('login: buttons keep focus through a failed submit (Jen C4)', () => {
  it('a failed verify started from the button leaves focus on the button', async () => {
    stubMatchMedia(false)
    verifyResponse = { status: 401, body: { error: 'invalid' } }
    const code = await toCodeStep()
    fireEvent.change(code, { target: { value: '12345678' } })
    const button = screen.getByRole('button', { name: 'Verify code' })
    button.focus()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(verifyCalls).toBe(1)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(document.activeElement).toBe(button)
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('a failed send started from the button leaves focus on the button', async () => {
    sendResponse = { status: 500, body: {} }
    const email = await renderLogin()
    fireEvent.change(email, { target: { value: 'qa-owner-a@example.test' } })
    const button = screen.getByRole('button', { name: 'Send code' })
    button.focus()
    await act(async () => {
      fireEvent.click(button)
    })
    expect(sendCodeCalls).toBe(1)
    expect(document.activeElement).toBe(button)
  })

  it('the busy button is aria-busy and aria-disabled, not natively disabled', async () => {
    let release!: () => void
    holdVerify = new Promise<void>((resolve) => {
      release = resolve
    })
    await signIn()
    const button = screen.getByRole('button', { name: 'Verify code' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.className).not.toContain('opacity-40')
    await act(async () => {
      fireEvent.click(button)
    })
    expect(verifyCalls).toBe(1)
    await act(async () => {
      release()
    })
  })
})

describe('login: "Send a new code" (Jen C5)', () => {
  it('resends to the same email, clears the code and the error, stays on the code step', async () => {
    stubMatchMedia(false)
    verifyResponse = { status: 401, body: { error: 'too_many_attempts' } }
    const code = await signIn()
    expect(screen.getByRole('alert').textContent).toBe('Too many wrong codes. Send a new code.')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    })
    expect(sendCodeCalls).toBe(2)
    expect(sendBodies[1]).toEqual({ email: 'qa-owner-a@example.test' })
    expect((code as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('8-digit code')).toBe(code)
    expect(document.activeElement).toBe(code)
  })

  it('on a coarse pointer a resend focuses the instruction line', async () => {
    stubMatchMedia(true)
    await toCodeStep()
    ;(document.activeElement as HTMLElement).blur()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    })
    expect(sendCodeCalls).toBe(2)
    expect((document.activeElement as HTMLElement).textContent).toBe('Code sent to qa-owner-a@example.test')
  })

  it("a rate-limited resend shows the server's limit in the table copy", async () => {
    await toCodeStep()
    sendResponse = { status: 429, body: { error: 'Too many codes requested. Try again later.' } }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    })
    expectAlert('Too many codes for this email in the last hour. Try again in an hour.')
    expect(screen.getByLabelText('8-digit code')).toBeTruthy()
  })

  it('is ignored while a request is in flight', async () => {
    let release!: () => void
    holdVerify = new Promise<void>((resolve) => {
      release = resolve
    })
    await signIn()
    const resend = screen.getByRole('button', { name: 'Send a new code' })
    expect(resend.getAttribute('aria-disabled')).toBe('true')
    await act(async () => {
      fireEvent.click(resend)
    })
    expect(sendCodeCalls).toBe(1)
    await act(async () => {
      release()
    })
  })
})

describe('login: touch focus both ways, long address, pasted code (Jen C6, C7, C8)', () => {
  async function backToEmail() {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    })
  }

  it('coarse: "Use a different email" focuses the instruction line, never the body', async () => {
    stubMatchMedia(true)
    await toCodeStep()
    await backToEmail()
    const active = document.activeElement as HTMLElement
    expect(active).not.toBe(document.body)
    expect(active.textContent).toBe('Enter your email to continue')
    expect(active.tabIndex).toBe(-1)
    // The next element in the tab order after it is the email field.
    const tabbables = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input'))
    const following = tabbables.find((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(following?.id).toBe('email')
  })

  it('fine: "Use a different email" focuses the email field', async () => {
    stubMatchMedia(false)
    await toCodeStep()
    await backToEmail()
    expect(document.activeElement).toBe(screen.getByLabelText('Email address'))
  })

  it('coarse: nothing is focused on first load', async () => {
    stubMatchMedia(true)
    await renderLogin()
    expect(document.activeElement).toBe(document.body)
  })

  it('the instruction line wraps anywhere, so a long address cannot widen the page', async () => {
    const long = 'margaret_fitzgerald_okonkwo_of_the_squamish_valley@example.test'
    const email = await renderLogin()
    fireEvent.change(email, { target: { value: long } })
    await enter(email)
    const line = screen.getByText(`Code sent to ${long}`)
    expect(line.className).toContain('[overflow-wrap:anywhere]')
  })

  it.each([
    [' 24681357', '24681357'],
    ['2468 1357', '24681357'],
    ['2468-1357', '24681357'],
    ['24681357 ', '24681357'],
    ['246813579', '24681357'],
  ])('a pasted %j keeps every digit (%s)', async (pasted, expected) => {
    const code = (await toCodeStep()) as HTMLInputElement
    fireEvent.change(code, { target: { value: pasted } })
    expect(code.value).toBe(expected)
    expect(code.hasAttribute('maxlength')).toBe(false)
  })

  it('the code field offers one-time-code autofill and a numeric keyboard; the email field autofills', async () => {
    const email = await renderLogin()
    expect(email.getAttribute('autocomplete')).toBe('email')
    const code = await (async () => {
      cleanup()
      return toCodeStep()
    })()
    expect(code.getAttribute('autocomplete')).toBe('one-time-code')
    expect(code.getAttribute('inputmode')).toBe('numeric')
  })
})
