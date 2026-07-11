import { notFound } from 'next/navigation'
import { isForumEnabled } from '@/lib/forum/flag'

/**
 * FORUM-1: server-side gate for the entire /forum page surface.
 *
 * The Forum is intentionally unshipped — there's no moderation capacity yet.
 * This layout wraps every page under (app)/forum/* (list, new-thread,
 * thread view, moderation queue, policy) in a single fail-closed check:
 * notFound() unless FORUM_ENABLED is explicitly 'true'. Previously the only
 * "lock" was a cosmetic disabled-looking sidebar entry — the pages
 * themselves rendered normally for anyone who navigated straight to a URL.
 */
export default function ForumLayout({ children }: { children: React.ReactNode }) {
  if (!isForumEnabled()) {
    notFound()
  }

  return children
}
