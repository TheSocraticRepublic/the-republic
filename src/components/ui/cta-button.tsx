'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode, Ref } from 'react'

/** The six instruments, each with its `--accent-{arm}` token in globals.css. */
export type CTAButtonArm = 'scout' | 'oracle' | 'gadfly' | 'lever' | 'mirror' | 'votes'

/**
 * Three recipes (app-arms P2-2):
 * - `primary`: the one action a page is for, inverted to full ink
 *   (`--text-primary` fill, `--surface-0` label). One per page.
 * - `secondary`: the neutral pill, the default, so existing callers keep it.
 * - `arm`: the instrument's accent, a 15% tint fill and a 30% border, with
 *   the label in `--accent-{arm}-ink`, the accent moved in lightness until it
 *   clears 4.5:1 on that fill. Needs `arm`. Allowed grounds: dark surface-0
 *   to surface-3 and the arm rooms; light-scope surface-0 to surface-3 and
 *   the daylight and paper grounds (tokens-contrast.test.ts pins them).
 *
 * Disabled is one recessed style in every variant, the B3a recipe below, so
 * its measured contrast holds whatever the variant. Busy keeps the variant's
 * own full-ink style.
 */
type CTAButtonVariantProps =
  | { variant?: 'primary' | 'secondary'; arm?: undefined }
  | { variant: 'arm'; arm: CTAButtonArm }

interface CTAButtonBaseProps {
  /** Pass the icon pre-rendered (e.g. `<Search size={13} strokeWidth={2} />`)
   *  alongside the label, not as a separate prop — this component is a
   *  Client Component, and Server Component callers can only cross that
   *  boundary with already-rendered elements (children), not raw component
   *  references. */
  children: ReactNode
  className?: string
  /** `sm` matches the investigations/forum "New X" links (px-4 py-2.5).
   *  `md` matches the concern-form submit button (px-6 py-3). */
  size?: 'sm' | 'md'
}

interface CTAButtonAsLink extends CTAButtonBaseProps {
  href: string
  onClick?: undefined
  disabled?: undefined
  busy?: undefined
  describedBy?: undefined
  ref?: undefined
  onUnavailable?: undefined
}

/** Native attributes a wrapper may add to the <button>: a Radix
 *  `Dialog.Trigger asChild` hands its child `aria-haspopup`, `aria-expanded`,
 *  `aria-controls` and `data-state` this way (UI plan C2b). The props this
 *  component owns are not among them. */
type CTAButtonPassThrough = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'className' | 'style' | 'onClick' | 'disabled' | 'type' | 'aria-disabled' | 'aria-busy' | 'aria-describedby'
>

interface CTAButtonAsButton extends CTAButtonBaseProps, CTAButtonPassThrough {
  href?: undefined
  /** Receives the click event when a wrapper (a Radix trigger) composes its
   *  own handler in; the component's own callers ignore it. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  /** Rendered as `aria-disabled="true"`, never the native `disabled`
   *  attribute: the button stays in the tab order (a keyboard or screen-reader
   *  user can still reach it and hear that it is unavailable), and the click
   *  handler below refuses to dispatch. Keyboard activation (Enter, Space) of
   *  a native button arrives as a click, so the same guard covers it. */
  disabled?: boolean
  /** Working, not unavailable: full ink, `aria-busy="true"` and
   *  `aria-disabled="true"`, and the click guard refuses as when disabled. */
  busy?: boolean
  /** The id of the text that says why the button is unavailable. Rendered as
   *  `aria-describedby` only while disabled (not busy). */
  describedBy?: string
  /** React 19 passes `ref` as a prop (the concern form's shortcut moves focus
   *  here before it dispatches). */
  ref?: Ref<HTMLButtonElement>
  /** Called, in place of `onClick`, when the button is activated while
   *  disabled (never while busy): for a form whose unavailable action takes
   *  the citizen to what is missing instead of doing nothing (the Lever's
   *  Generate sends focus to the province). Without it a disabled activation
   *  does nothing. */
  onUnavailable?: () => void
}

type CTAButtonProps = (CTAButtonAsLink | CTAButtonAsButton) & CTAButtonVariantProps

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-4 py-2.5',
  md: 'px-6 py-3',
}

const SECONDARY_STYLE: CSSProperties = {
  backgroundColor: 'var(--surface-3)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
}

/** The border is the fill's own colour, not none: every variant and state
 *  keeps a 1px border, so the button keeps its size when it changes state. */
const PRIMARY_STYLE: CSSProperties = {
  backgroundColor: 'var(--text-primary)',
  color: 'var(--surface-0)',
  border: '1px solid var(--text-primary)',
}

function armStyle(arm: CTAButtonArm): CSSProperties {
  const accent = `var(--accent-${arm})`
  return {
    backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
    color: `var(--accent-${arm}-ink)`,
    border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
  }
}

/** Disabled: a recessed fill with faint ink, never opacity. Opacity paints the
 *  whole element, focus ring included, and dimmed the ring to 1.8:1 (Jen C1);
 *  this measures 5.45:1 for the label and 8.9:1 for the ring. */
const PILL_STYLE_UNAVAILABLE: CSSProperties = {
  backgroundColor: 'var(--surface-2)',
  color: 'var(--text-faint)',
  border: '1px solid var(--border)',
}

/** Passed-through handlers that can activate a button: a wrapper (a Radix
 *  DropdownMenu or Select trigger) may open on pointerdown or keydown rather
 *  than click. While disabled or busy they are not called, the same as
 *  onClick (Razor C2b N1). Enter and leave (pointer and mouse), focus and
 *  blur are not activation and pass untouched, so a tooltip still opens on a
 *  disabled button and still closes when it turns busy (Razor C2b check N2).
 *  Key handlers stay guarded: keydown is how a menu trigger opens. */
const ACTIVATION_HANDLER = /^on(Pointer|Mouse|Key|Touch|Click|Context|Aux)/
const NOT_ACTIVATION = /^on(Pointer|Mouse)(Enter|Leave)(Capture)?$/

function guardActivation(
  props: Record<string, unknown>,
  refuse: boolean
): Record<string, unknown> {
  if (!refuse) return props
  const out: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === 'function' && ACTIVATION_HANDLER.test(name) && !NOT_ACTIVATION.test(name)) {
      // Swallowed, never preventDefault'd: Tab must still move focus off
      // the button, and a press must still focus it.
      out[name] = () => {}
    } else {
      out[name] = value
    }
  }
  return out
}

export function CTAButton({
  children,
  className,
  size = 'sm',
  href,
  onClick,
  disabled,
  busy,
  describedBy,
  ref,
  variant = 'secondary',
  arm,
  onUnavailable,
  ...passThrough
}: CTAButtonProps) {
  const unavailable = Boolean(disabled) && !busy
  const variantStyle =
    variant === 'primary' ? PRIMARY_STYLE : variant === 'arm' && arm ? armStyle(arm) : SECONDARY_STYLE
  const classes = clsx(
    // whitespace-nowrap: the label never wraps, so the button keeps its height
    // between rest and busy at every width.
    'inline-flex items-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150',
    SIZE_CLASSES[size],
    busy ? 'cursor-progress' : unavailable ? 'cursor-not-allowed' : 'hover:opacity-90',
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes} style={variantStyle}>
        {children}
      </Link>
    )
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || busy) {
      event.preventDefault()
      if (unavailable) onUnavailable?.()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      {...guardActivation(passThrough, Boolean(disabled || busy))}
      ref={ref}
      type="button"
      onClick={handleClick}
      aria-disabled={disabled || busy ? 'true' : undefined}
      aria-busy={busy ? 'true' : undefined}
      aria-describedby={unavailable ? describedBy : undefined}
      className={classes}
      style={unavailable ? PILL_STYLE_UNAVAILABLE : variantStyle}
    >
      {children}
    </button>
  )
}
