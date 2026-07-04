'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface CTAButtonBaseProps {
  /** Convenience icon for the common static-label case. For dynamic content
   *  (e.g. a loading-state swap), compose the icon into `children` instead
   *  and omit this prop. */
  icon?: LucideIcon
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
  icon: Icon,
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
        {Icon && <Icon size={13} strokeWidth={2} />}
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
