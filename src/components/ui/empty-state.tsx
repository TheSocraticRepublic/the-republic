import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateAction {
  label: string
  href: string
  /** Replace the current history entry instead of pushing one: for an action
   *  that reopens this same page in another state (Gadfly's and Lever's
   *  `?new=1`), so dismissing it doesn't leave a dead Back step. */
  replace?: boolean
}

interface EmptyStateProps {
  /** Optional icon shown above the message. */
  icon?: LucideIcon
  /** Optional short heading above the message. */
  heading?: string
  message: ReactNode
  action?: EmptyStateAction
  /** Renders the message in the serif-italic "philosophical aside" register
   *  used by Gadfly/Lever, instead of the plain register used elsewhere. */
  serif?: boolean
  /** Escape hatch for per-site wrapper differences (e.g. investigations'
   *  shadow-sm) without baking every variant into this component.
   *  ADDITIVE ONLY: appended after the base classes, but Tailwind's generated
   *  stylesheet order (not source order) decides collisions — passing a
   *  conflicting utility (a different `px-`/`py-`/`rounded-`/`bg-`) will fight
   *  the base classes unpredictably. Keep this to non-overlapping additions
   *  (shadows, margins). If real variants emerge, switch to a merge-aware
   *  `cn()`/`tailwind-merge` here rather than passing overrides through. */
  className?: string
}

export function EmptyState({
  icon: Icon,
  heading,
  message,
  action,
  serif,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface-1 px-6 py-10 text-center${className ? ` ${className}` : ''}`}
    >
      {Icon && (
        <Icon
          size={20}
          strokeWidth={1.5}
          className="mx-auto mb-3 text-text-faint"
          aria-hidden="true"
        />
      )}
      {heading && (
        <h3 className="mb-1 text-sm font-semibold text-text-primary">{heading}</h3>
      )}
      <p className={serif ? 'font-serif italic text-sm text-text-muted' : 'text-sm text-text-muted'}>
        {message}
      </p>
      {action && (
        // The action is the arm's first step, so it is never smaller than the
        // message: 14px, a 24px hit area, 44px on coarse pointers (Jen C2a C6).
        <p className="mt-1 pointer-coarse:mt-0">
          <Link
            href={action.href}
            replace={action.replace}
            className="inline-flex min-h-6 items-center text-sm text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary pointer-coarse:min-h-11"
          >
            {action.label}
          </Link>
        </p>
      )}
    </div>
  )
}
