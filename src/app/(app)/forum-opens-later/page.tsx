import { notFound } from 'next/navigation'
import { isForumEnabled } from '@/lib/forum/flag'
import { ForumOpensLater } from '@/components/forum/forum-opens-later'

/**
 * The target of the middleware's Forum gate. While isForumEnabled() is false,
 * src/middleware.ts rewrites every /forum URL here, so the Forum segment
 * (its layout, pages and generateMetadata) never executes and no Forum data is
 * read. This route lives OUTSIDE src/app/(app)/forum for exactly that reason.
 * The URL the citizen typed stays in the address bar.
 */
export const metadata = { title: 'Forum' }

export default function ForumOpensLaterPage() {
  // Once the Forum opens, this page has nothing true to say.
  if (isForumEnabled()) notFound()
  return <ForumOpensLater />
}
