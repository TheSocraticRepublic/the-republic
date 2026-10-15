// @vitest-environment jsdom
import { createElement, type ComponentProps } from 'react'
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
  vi.restoreAllMocks()
  push.mockReset()
})

function renderButton(disabled: boolean, extra: { busy?: boolean; describedBy?: string; ref?: unknown } = {}) {
  const onClick = vi.fn()
  // children travel as createElement's third argument; the cast only satisfies
  // the props type, which declares children as required.
  const props = { onClick, disabled, ...extra } as unknown as ComponentProps<typeof CTAButton>
  render(createElement(CTAButton, props, 'Start Investigation'))
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

describe('CTAButton states (Jen C1, C2)', () => {
  it('disabled: recessed fill and faint ink inline, no opacity class', () => {
    const { button } = renderButton(true)
    expect(button.style.backgroundColor).toBe('var(--surface-2)')
    expect(button.style.color).toBe('var(--text-faint)')
    expect(button.style.border).toBe('1px solid var(--border)')
    expect(button.className).not.toMatch(/opacity-/)
    expect(button.className).toContain('cursor-not-allowed')
  })

  it('enabled: the full-ink pill', () => {
    const { button } = renderButton(false)
    expect(button.style.backgroundColor).toBe('var(--surface-3)')
    expect(button.style.color).toBe('var(--text-primary)')
    expect(button.style.border).toBe('1px solid var(--border-strong)')
  })

  it('busy: full ink, aria-busy and aria-disabled, cursor-progress, and the click is refused', () => {
    const { button, onClick } = renderButton(false, { busy: true })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.style.color).toBe('var(--text-primary)')
    expect(button.style.backgroundColor).toBe('var(--surface-3)')
    expect(button.className).toContain('cursor-progress')
    expect(button.className).not.toMatch(/opacity-/)
    fireEvent.click(button)
    keyboardActivate(button, 'Enter')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('busy wins over disabled: full ink, not the recessed style', () => {
    const { button } = renderButton(true, { busy: true })
    expect(button.style.color).toBe('var(--text-primary)')
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('the label never wraps', () => {
    const { button } = renderButton(false)
    expect(button.className).toContain('whitespace-nowrap')
  })

  it('describedBy is rendered only while disabled (not enabled, not busy)', () => {
    const disabled = renderButton(true, { describedBy: 'why' }).button
    expect(disabled.getAttribute('aria-describedby')).toBe('why')
    cleanup()
    expect(renderButton(false, { describedBy: 'why' }).button.hasAttribute('aria-describedby')).toBe(false)
    cleanup()
    expect(renderButton(true, { describedBy: 'why', busy: true }).button.hasAttribute('aria-describedby')).toBe(false)
  })

  it('passes ref to the <button>', () => {
    const ref = { current: null as HTMLButtonElement | null }
    const { button } = renderButton(false, { ref })
    expect(ref.current).toBe(button)
  })
})

describe('ConcernForm submit paths', () => {
  let investigatePosts: number
  let releaseInvestigate: (() => void) | null
  let failInvestigate: boolean

  beforeEach(() => {
    investigatePosts = 0
    releaseInvestigate = null
    failInvestigate = false
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
          if (failInvestigate) return { ok: false, status: 500, json: async () => ({ error: 'held' }) }
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
      submit: screen.getByRole('button', { name: /Start an investigation/ }),
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
      fireEvent.click(screen.getByRole('button', { name: /Starting…/ }))
    })
    expect(investigatePosts).toBe(1)
  })

  it('the disabled button names what is missing: a visible reason line it is described by (Jen C2)', async () => {
    const { submit, textarea } = await renderForm()
    const reason = document.getElementById('concern-submit-reason')
    expect(reason?.textContent).toBe('Describe your concern to start.')
    expect(submit.getAttribute('aria-describedby')).toBe('concern-submit-reason')
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    expect(document.getElementById('concern-submit-reason')).toBeNull()
    expect(submit.hasAttribute('aria-describedby')).toBe(false)
    expect(submit.hasAttribute('aria-disabled')).toBe(false)
  })

  it('busy: "Starting…" at full ink with aria-busy, and no reason line', async () => {
    const { textarea } = await renderForm()
    fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
    await shortcut(textarea, 'ctrlKey')
    const busy = screen.getByRole('button', { name: /Starting…/ })
    expect(busy.getAttribute('aria-busy')).toBe('true')
    // The concern form's Start is the primary variant (UI plan C1): full ink
    // is the inverted fill, never the recessed disabled style.
    expect(busy.style.backgroundColor).toBe('var(--text-primary)')
    expect(busy.style.color).toBe('var(--surface-0)')
    expect(document.getElementById('concern-submit-reason')).toBeNull()
  })

  it.each(['metaKey', 'ctrlKey'] as const)(
    'the %s+Enter shortcut moves focus to the Start button, and it stays there after an error (Jen C3)',
    async (modifier) => {
      failInvestigate = true
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { textarea, submit } = await renderForm()
      fireEvent.change(textarea, { target: { value: 'A gravel mine expansion' } })
      textarea.focus()
      await shortcut(textarea, modifier)
      expect(document.activeElement).toBe(submit)
      expect(document.activeElement).not.toBe(document.body)
      await act(async () => {
        releaseInvestigate?.()
      })
      expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
      expect(document.activeElement).toBe(submit)
      expect(submit.textContent).toContain('Start an investigation')
    }
  )

  it('the shortcut with an empty concern leaves focus in the textarea', async () => {
    const { textarea } = await renderForm()
    textarea.focus()
    await shortcut(textarea, 'ctrlKey')
    expect(document.activeElement).toBe(textarea)
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
