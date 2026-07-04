'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

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
}

interface CTAButtonAsButton extends CTAButtonBaseProps {
  href?: undefined
  onClick?: () => void
  disabled?: boolean
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

export function CTAButton({
  children,
  className,
  size = 'sm',
  href,
  onClick,
  disabled,
}: CTAButtonProps) {
  const classes = clsx(
    'inline-flex items-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150',
    SIZE_CLASSES[size],
    disabled ? 'cursor-not-allowed opacity-30' : 'opacity-100 hover:opacity-90',
    className
  )

  if (href) {
    return (
      <Link href={href} className={classes} style={PILL_STYLE}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
      style={PILL_STYLE}
    >
      {children}
    </button>
  )
}
