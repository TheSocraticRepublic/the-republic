import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateAction {
  label: string
  href: string
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
   *  shadow-sm) without baking every variant into this component. */
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
        <p className="mt-2 text-xs text-text-faint">
          <Link
            href={action.href}
            className="text-text-secondary underline underline-offset-2 hover:text-text-primary transition-colors"
          >
            {action.label}
          </Link>
        </p>
      )}
    </div>
  )
}
