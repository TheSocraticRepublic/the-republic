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
  holdVerify = null
  setLocation('')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const respond = (body: Record<string, unknown>, status = 200) => ({ ok: status < 400, status, json: async () => body })
      if (url === '/api/auth/send-code' && init?.method === 'POST') {
        sendCodeCalls++
        return respond({ success: true })
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
    expect((screen.getByRole('button', { name: 'Send code' }) as HTMLButtonElement).disabled).toBe(true)
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
    expect((screen.getByRole('button', { name: 'Verify code' }) as HTMLButtonElement).disabled).toBe(true)
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

  it.each([
    ['expired', 'This code has expired. Request a new one.'],
    ['too_many_attempts', 'Too many attempts. Request a new code.'],
    ['invalid', 'Invalid code. Try again.'],
  ])('the %s error reads without "Please"', async (error, expected) => {
    verifyResponse = { status: 401, body: { error } }
    await signIn()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe(expected)
    expect(alert.textContent).not.toMatch(/please/i)
  })
})
