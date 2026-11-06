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
 * bar is `--text-faint` at 60%, neutral but at the arm bars' presence
 * (2.85:1, per Jen E1 C6), not the rule's colour.
 *
 * The back link is a real `<Link>`: a 24px box in flow on every pointer, and
 * on coarse pointers a 44px hit area laid over it by an `::after` (10px above
 * and below), so the label keeps its position and the focus ring (the global
 * `--focus-ring` outline, globals.css) still hugs the label (Jen E1 C5).
 */
interface DetailHeaderProps {
  arm?: string
  backHref: string
  /** Plain-instructional, naming the destination as the sidebar does, e.g. "Back to Vote Tracker". */
  backLabel: string
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  /**
   * A long title (a vote page's motion over 140 characters) steps down to
   * 20/28 below 640px and sets with `text-pretty`, so the page's answer is not
   * pushed below a phone's fold (Jen E2b C5).
   */
  long?: boolean
}

export function DetailHeader({ arm, backHref, backLabel, title, meta, action, long = false }: DetailHeaderProps) {
  const barColor = arm
    ? `color-mix(in srgb, var(--accent-${arm}) 60%, transparent)`
    : 'color-mix(in srgb, var(--text-faint) 60%, transparent)'
  return (
    <div data-detail-header>
      <Link
        href={backHref}
        className="relative -ml-1 mb-4 inline-flex min-h-6 items-center gap-1 rounded-sm pr-1 text-xs text-text-muted transition-colors hover:text-text-primary pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5"
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
          <h1 className={`font-display ${long ? 'text-xl leading-7 sm:text-2xl text-pretty' : 'text-2xl'} font-bold text-text-primary break-words`}>
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
