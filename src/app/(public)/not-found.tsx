import { NotFoundCard } from '@/components/ui/not-found-card'

export const metadata = { title: 'Page not found' }

/**
 * A notFound() inside the public pages (a missing /archive/<id>) renders here,
 * inside the public layout's header and <main>: the card only (Jen, B2
 * design review C2).
 *
 * The action is always the home page. Every public page is statically
 * generated or ISR (/archive/<id> revalidates every 30 minutes); a session
 * read here made Next drop the 404's server render, leaving an empty body
 * until JavaScript ran (Razor DN1). A static 404 that works without
 * JavaScript beats a session-aware one that doesn't.
 */
export default function PublicNotFound() {
  return (
    <div className="flex justify-center py-6">
      <NotFoundCard action="home" />
    </div>
  )
}
