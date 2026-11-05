import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/**
 * The header for a detail page: the sibling of `ArmHeader` (arm-header.tsx)
 * for pages one level below an arm's landing. A back link to the parent, the
 * page's single `h1`, the same 48x3 accent bar and `--border-strong` rule,
 * and an optional meta line (the Votes freshness badge lives there) and
 * action.
 *
 * `arm` is optional because profile pages belong to no arm: without one the
 * bar takes the neutral `--border-strong` instead of an arm accent.
 *
 * The back link is a real `<Link>`: a 24px hit area on fine pointers, 44px on
 * coarse ones, and the global `--focus-ring` outline (globals.css) on focus.
 */
interface DetailHeaderProps {
  arm?: string
  backHref: string
  /** Plain-instructional, e.g. "Back to Votes". */
  backLabel: string
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
}

export function DetailHeader({ arm, backHref, backLabel, title, meta, action }: DetailHeaderProps) {
  const barColor = arm
    ? `color-mix(in srgb, var(--accent-${arm}) 60%, transparent)`
    : 'var(--border-strong)'
  return (
    <div data-detail-header>
      <Link
        href={backHref}
        className="-ml-1 mb-4 inline-flex min-h-6 items-center gap-1 rounded-sm pr-1 text-xs text-text-muted transition-colors hover:text-text-primary pointer-coarse:min-h-11"
      >
        <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        {backLabel}
      </Link>
      <div className={action ? 'flex items-start justify-between gap-4' : undefined}>
        <div className="min-w-0">
          {/* Accent bar */}
          <div
            data-accent-bar
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              marginBottom: 8,
              backgroundColor: barColor,
            }}
          />
          <h1 className="font-display text-2xl font-bold text-text-primary break-words">
            {title}
          </h1>
          {meta && (
            <div data-detail-meta className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              {meta}
            </div>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0 mt-1">
            {action}
          </div>
        )}
      </div>
      <div
        className="mt-6 mb-8 h-px"
        style={{ backgroundColor: 'var(--border-strong)' }}
      />
    </div>
  )
}
