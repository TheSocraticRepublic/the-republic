import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * What a signed-in visitor sees at any /forum URL while the Forum is gated
 * (R9, 2026-10-11): an honest "opens later" page, not a 404. "Page not found"
 * was untrue about a feature that exists.
 */
export function ForumOpensLater() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12" data-forum-gated="true">
      <h1 className="font-display text-2xl font-bold text-text-primary">Forum</h1>
      <div className="mt-6">
        <EmptyState
          icon={MessageSquare}
          message="The Forum opens later. Nothing here yet."
          // One way onward, so the page is not a dead end (Jen C6). The
          // sentence itself is the plan's, verbatim.
          action={{ label: 'Start an investigation', href: '/investigate' }}
        />
      </div>
    </div>
  )
}
