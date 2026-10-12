import Link from 'next/link'
import { cookies } from 'next/headers'
import { AUTH_COOKIE } from '@/lib/auth/middleware'
import { verifyJWT } from '@/lib/auth/jwt'

/**
 * A signed-in citizen who hits a dead link is sent back into the app, not to
 * the marketing page (landing L13, mobile P2-2). "Signed in" means the same
 * thing the middleware means: a session cookie whose JWT verifies. A missing,
 * expired or forged token is simply "signed out" here; there is nothing to
 * report, and the action degrades to the home page.
 */
async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  if (!token) return false
  return (await verifyJWT(token)) !== null
}

export default async function NotFound() {
  const signedIn = await isSignedIn()
  const action = signedIn
    ? { href: '/investigations', label: 'Go to your investigations' }
    : { href: '/', label: 'Go to the home page' }

  return (
    <div className="flex min-h-dvh flex-col bg-surface-0">
      <header className="px-6 py-5">
        {/* Wordmark (R6): Fraunces, no tagline. */}
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-[-0.01em] text-text-primary"
        >
          Open Cave
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface-1 p-8 shadow-sm">
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="mt-6">
            <Link
              href={action.href}
              data-not-found-action={signedIn ? 'signed-in' : 'signed-out'}
              className="inline-flex min-h-11 items-center rounded-lg bg-text-primary px-4 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
            >
              {action.label}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
