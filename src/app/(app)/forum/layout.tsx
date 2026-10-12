import { isForumEnabled } from '@/lib/forum/flag'
import { ForumOpensLater } from '@/components/forum/forum-opens-later'

/**
 * FORUM-1: the Forum page surface is gated in MIDDLEWARE, not here.
 *
 * While isForumEnabled() is false, src/middleware.ts rewrites every /forum
 * URL (page loads and RSC requests alike) to /forum-opens-later, a route
 * outside this segment, so nothing in src/app/(app)/forum runs: no page, no
 * generateMetadata, no database read. The gate itself (src/lib/forum/flag.ts)
 * and the /api/forum/* 404s are unchanged.
 *
 * This check is a presentation fallback only. The App Router renders a
 * layout and its page in parallel, so a layout that withholds `children`
 * does NOT stop the page from executing or its output reaching the client
 * payload (Razor W1, 2026-10-12). If this branch is ever reached, the
 * middleware gate has been bypassed; do not rely on it for protection.
 */
export default function ForumLayout({ children }: { children: React.ReactNode }) {
  if (!isForumEnabled()) {
    return <ForumOpensLater />
  }

  return children
}
