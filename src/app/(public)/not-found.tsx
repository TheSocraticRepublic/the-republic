import { NotFoundCard } from '@/components/ui/not-found-card'

export const metadata = { title: 'Page not found' }

/**
 * A notFound() inside the public pages (a missing /archive/<id>) renders here,
 * inside the public layout's header and <main>: the card only (Jen, B2
 * design review C2). Signed in or not, so the action follows the session.
 *
 * Known limit (Razor DN1, measured 2026-10-12 on Next 16.3.8): a notFound()
 * from a DYNAMIC segment's page (/archive/[investigationId]) is answered with
 * Next's error shell (`<html id="__next_error__">`, empty body, status 404),
 * and this card is drawn by the client from the inlined payload. It is the
 * framework, not this file: a bare `notFound()` page under any dynamic segment
 * does the same, with no not-found file, a minimal root layout, no middleware,
 * no instrumentation and no Sentry, while a static segment renders server-side.
 */
export default function PublicNotFound() {
  return (
    <div className="flex justify-center py-6">
      <NotFoundCard />
    </div>
  )
}
