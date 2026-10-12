import { NotFoundCard } from '@/components/ui/not-found-card'

export const metadata = { title: 'Page not found' }

/**
 * A notFound() inside the public pages (a missing /archive/<id>) renders here,
 * inside the public layout's header and <main>: the card only (Jen, B2
 * design review C2). Signed in or not, so the action follows the session.
 */
export default function PublicNotFound() {
  return (
    <div className="flex justify-center py-6">
      <NotFoundCard action="session" />
    </div>
  )
}
