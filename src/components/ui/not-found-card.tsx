import Link from 'next/link'
import { cookies } from 'next/headers'
import { AUTH_COOKIE } from '@/lib/auth/middleware'
import { verifyJWT } from '@/lib/auth/jwt'

/**
 * "Signed in" means what the middleware means: a session cookie whose JWT
 * verifies. A missing, expired or forged token is simply "signed out" here;
 * there is nothing to report, and the action degrades to the home page.
 */
async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  if (!token) return false
  return (await verifyJWT(token)) !== null
}

/**
 * The 404 card: heading, sentence and one action, with no page chrome. Each
 * not-found boundary supplies its own surroundings, because a notFound()
 * thrown inside a route group renders INSIDE that group's layout, which
 * already has a wordmark and a <main> (Jen, B2 design review C2).
 *
 * `action`:
 * - 'session': a signed-in citizen is sent back into the app, anyone else to
 *   the home page (landing L13, mobile P2-2);
 * - 'app': always back into the app; the (app) group is signed-in only.
 */
export async function NotFoundCard({ action }: { action: 'session' | 'app' }) {
  const signedIn = action === 'app' ? true : await isSignedIn()
  const target = signedIn
    ? { href: '/investigations', label: 'Go to your investigations' }
    : { href: '/', label: 'Go to the home page' }

  return (
    <div
      data-not-found-card=""
      className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-8 shadow-sm"
    >
      <h1 className="font-display text-xl font-semibold text-text-primary">Page not found</h1>
      <p className="mt-2 text-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-6">
        <Link
          href={target.href}
          data-not-found-action={signedIn ? 'signed-in' : 'signed-out'}
          className="inline-flex min-h-11 items-center rounded-lg bg-text-primary px-4 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
        >
          {target.label}
        </Link>
      </div>
    </div>
  )
}
