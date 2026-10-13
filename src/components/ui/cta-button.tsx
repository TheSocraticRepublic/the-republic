'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { MouseEvent, ReactNode, Ref } from 'react'

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
}

interface CTAButtonAsButton extends CTAButtonBaseProps {
  href?: undefined
  onClick?: () => void
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
}

type CTAButtonProps = CTAButtonAsLink | CTAButtonAsButton

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-4 py-2.5',
  md: 'px-6 py-3',
}

const PILL_STYLE = {
  backgroundColor: 'var(--surface-3)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
}

/** Disabled: a recessed fill with faint ink, never opacity. Opacity paints the
 *  whole element, focus ring included, and dimmed the ring to 1.8:1 (Jen C1);
 *  this measures 5.45:1 for the label and 8.9:1 for the ring. */
const PILL_STYLE_UNAVAILABLE = {
  backgroundColor: 'var(--surface-2)',
  color: 'var(--text-faint)',
  border: '1px solid var(--border)',
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
}: CTAButtonProps) {
  const unavailable = Boolean(disabled) && !busy
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
      <Link href={href} className={classes} style={PILL_STYLE}>
        {children}
      </Link>
    )
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || busy) {
      event.preventDefault()
      return
    }
    onClick?.()
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      aria-disabled={disabled || busy ? 'true' : undefined}
      aria-busy={busy ? 'true' : undefined}
      aria-describedby={unavailable ? describedBy : undefined}
      className={classes}
      style={unavailable ? PILL_STYLE_UNAVAILABLE : PILL_STYLE}
    >
      {children}
    </button>
  )
}
