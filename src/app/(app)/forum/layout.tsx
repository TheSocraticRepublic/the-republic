import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { isForumEnabled } from '@/lib/forum/flag'

/**
 * FORUM-1: server-side gate for the entire /forum page surface.
 *
 * The Forum is intentionally unshipped — there's no moderation capacity yet.
 * This layout wraps every page under (app)/forum/* (list, new-thread,
 * thread view, moderation queue, policy) in a single fail-closed check on
 * isForumEnabled(): unless FORUM_ENABLED is explicitly 'true', no Forum page
 * renders. The gate itself (src/lib/forum/flag.ts) and the /api/forum/* 404s
 * are unchanged.
 *
 * What a gated visitor sees (R9, 2026-10-11): an honest "opens later" page in
 * place of the Forum, not a 404. "Page not found" was untrue about a feature
 * that exists. This is presentation only; the children are never rendered
 * while the gate is off.
 */
export default function ForumLayout({ children }: { children: React.ReactNode }) {
  if (!isForumEnabled()) {
    return <ForumOpensLater />
  }

  return children
}

function ForumOpensLater() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12" data-forum-gated="true">
      <h1 className="font-display text-2xl font-bold text-text-primary">Forum</h1>
      <div className="mt-6">
        <EmptyState icon={MessageSquare} message="The Forum opens later. Nothing here yet." />
      </div>
    </div>
  )
}
