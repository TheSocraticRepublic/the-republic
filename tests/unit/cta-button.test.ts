// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/*
 * Disabled actions, honestly scoped (UI plan B3a). Two of the four event
 * paths live here:
 *   1. pointer click on CTAButton;
 *   2. keyboard activation (Enter, Space) on CTAButton;
 *   4. concern-form's Cmd/Ctrl+Enter shortcut.
 * (Path 3, the login page's Enter handler, is in login-redirect.test.ts.)
 *
 * A disabled CTAButton is `aria-disabled="true"`, not natively disabled, so
 * it stays focusable and the click guard is the only thing stopping a
 * dispatch. Each path is asserted to dispatch nothing while disabled, and
 * each has a positive sibling that dispatches when enabled, so a guard that
 * blocks everything cannot pass either.
 *
 * Keyboard activation: a browser turns Enter/Space on a focused native
 * <button> into a `click` event (detail 0). jsdom does not synthesise that
 * click, so path 2 is driven here as the click the browser would dispatch,
 * plus the raw keydown/keyup; the real keypress is exercised in the harness
 * browser check.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { CTAButton } from '@/components/ui/cta-button'
import { ConcernForm } from '@/components/investigation/concern-form'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  push.mockReset()
})

function renderButton(disabled: boolean) {
  const onClick = vi.fn()
  render(createElement(CTAButton, { onClick, disabled, children: 'Start Investigation' }))
  return { onClick, button: screen.getByRole('button', { name: 'Start Investigation' }) }
}

/** The click a browser dispatches for Enter/Space on a focused button. */
function keyboardActivate(button: HTMLElement, key: 'Enter' | ' ') {
  fireEvent.keyDown(button, { key })
  fireEvent.keyUp(button, { key })
  fireEvent.click(button, { detail: 0 })
}

describe('CTAButton disabled', () => {
  it('is aria-disabled, not natively disabled, and stays in the tab order', () => {
    const { button } = renderButton(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect((button as HTMLButtonElement).disabled).toBe(false)
    expect(button.tabIndex).toBe(0)
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  it('path 1: a pointer click dispatches nothing', () => {
    const { button, onClick } = renderButton(true)
    fireEvent.click(button, { detail: 1 })
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([
    ['Enter', 'Enter' as const],
    ['Space', ' ' as const],
  ])('path 2: keyboard activation (%s) dispatches nothing', (_name, key) => {
    const { button, onClick } = renderButton(true)
    button.focus()
    keyboardActivate(button, key)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('prevents the default action of the refused click', () => {
    const { button } = renderButton(true)
    const notCancelled = fireEvent.click(button)
    expect(notCancelled).toBe(false)
  })
})

describe('CTAButton enabled', () => {
  it('has no aria-disabled attribute', () => {
    const { button } = renderButton(false)
    expect(button.hasAttribute('aria-disabled')).toBe(false)
    expect(button.getAttribute('type')).toBe('button')
  })

  it('path 1: a pointer click dispatches once', () => {
    const { button, onClick } = renderButton(false)
    fireEvent.click(button, { detail: 1 })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['Enter', 'Enter' as const],
    ['Space', ' ' as const],
  ])('path 2: keyboard activation (%s) dispatches once', (_name, key) => {
    const { button, onClick } = renderButton(false)
    button.focus()
    keyboardActivate(button, key)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ConcernForm submit paths', () => {
  let investigatePosts: number
  let releaseInvestigate: (() => void) | null

  beforeEach(() => {
    investigatePosts = 0
    releaseInvestigate = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/mirror/jurisdictions') return { ok: true, status: 200, json: async () => ({ jurisdictions: [] }) }
        if (url === '/api/investigate' && init?.method === 'POST') {
          investigatePosts++
          // Held open until the test releases it, so `loading` stays true.
          await new Promise<void>((resolve) => {
            releaseInvestigate = resolve
          })
          return { ok: true, status: 202, json: async () => ({ id: 'inv-1' }) }
        }
        throw new Error(`unexpected fetch ${url}`)
      })
    )
  })

  async function renderForm() {
    await act(async () => {
      render(createElement(ConcernForm))
    })
    return {
      textarea: screen.getByLabelText('Describe your concern'),
      submit: screen.getByRole('button', { name: /Start Investigation/ }),
    }
  }

  async function shortcut(textarea: HTMLElement, modifier: 'metaKey' | 'ctrlKey') {
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', [modifier]: true })
    })
  }

  it('the button is aria-disabled while the concern is empty', async () => {
    const { submit } = await renderForm()
    expect(submit.getAttribute('aria-disabled')).toBe('true')
  })

  it.each(['metaKey', 'ctrlKey'] as const)(
    'path 4: %s+Enter with an empty concern dispatches nothing',
    async (modifier) => {
      const { textarea } = await renderForm()
      await shortcut(textarea, modifier)
      expect(investigatePosts).toBe(0)
    }
  )

  it('path 4: the shortcut with a whitespace-only concern dispatches nothing', async () => {
    const { textarea } = await renderForm()
    fireEvent.change(textarea, { target: { value: '   \n  ' } })
    await shortcut(textarea, 'ctrlKey')
    expect(investigatePosts).toBe(0)
  })

  it('path 1: clicking the disabled button with an empty concern dispatches nothing', async () => {
    const { submit } = await renderForm()
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(investigatePosts).toBe(0)
  })

  it.each(['metaKey', 'ctrlKey'] as const)(
    'path 4: %s+Enter with a concern dispatches once',
    async (modifier) => {
      const { textarea } = await renderForm()
      fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
      await shortcut(textarea, modifier)
      expect(investigatePosts).toBe(1)
    }
  )

  it('path 4: a second shortcut while the first request is in flight dispatches nothing', async () => {
    const { textarea, submit } = await renderForm()
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    await shortcut(textarea, 'ctrlKey')
    expect(investigatePosts).toBe(1)
    expect(submit.getAttribute('aria-disabled')).toBe('true')
    await shortcut(textarea, 'metaKey')
    expect(investigatePosts).toBe(1)
    await act(async () => {
      releaseInvestigate?.()
    })
    expect(push).toHaveBeenCalledWith('/investigate/inv-1')
  })

  it('path 1: clicking the button while the first request is in flight dispatches nothing', async () => {
    const { textarea, submit } = await renderForm()
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(investigatePosts).toBe(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Starting investigation/ }))
    })
    expect(investigatePosts).toBe(1)
  })

  it('a plain Enter (no modifier) never submits', async () => {
    const { textarea } = await renderForm()
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })
    expect(investigatePosts).toBe(0)
  })
})
