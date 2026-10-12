import { NotFoundCard } from '@/components/ui/not-found-card'

export const metadata = { title: 'Page not found' }

/**
 * A notFound() inside the app (a stale /lever/<id>, /investigate/<id>, ...)
 * renders here, INSIDE the app shell, which already has the wordmark and the
 * page's <main>. So: the card only, centred in the shell's scroller, with no
 * header, no <main> and no viewport-height box (Jen, B2 design review C2).
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <NotFoundCard action="app" />
    </div>
  )
}
