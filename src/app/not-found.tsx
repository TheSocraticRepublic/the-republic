import Link from 'next/link'
import { NotFoundCard } from '@/components/ui/not-found-card'

export const metadata = { title: 'Page not found' }

/**
 * The top-level 404: unmatched URLs, and notFound() from segments outside
 * the (app) and (public) groups. It has no layout around it but the root, so
 * it brings its own chrome: the wordmark and the page's one <main>. The
 * groups have their own not-found pages that render the card only.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-0">
      <header className="px-6 py-3">
        {/* Wordmark (R6): Fraunces, no tagline. A 44px target. */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-display text-lg font-semibold tracking-[-0.01em] text-text-primary"
        >
          Open Cave
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <NotFoundCard />
      </main>
    </div>
  )
}
