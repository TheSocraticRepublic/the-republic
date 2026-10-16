import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'
import { safeRedirectTarget } from '@/lib/navigation/safe-redirect'
import { HANDOFF_PATH, handoffFromSearch, handoffTarget } from '@/lib/pending-concern'

/** Any serialised origin will do: it only anchors the check below. */
const CHECK_ORIGIN = 'http://onboarding.invalid'

/**
 * Where onboarding returns to: the path, plus an Investigate handoff when the
 * request carried a valid one (UI plan C4, Razor W2), so a first-time citizen
 * who wrote a concern on the landing is still offered it after setup. Only the
 * handoff is carried, validated (32 hex). The result goes through
 * safeRedirectTarget here, and again on the setup page when it is used; if
 * the check would change it, the bare path is used instead.
 */
function onboardingReturnTarget(path: string, search: string): string {
  const handoff = path === HANDOFF_PATH ? handoffFromSearch(search) : null
  if (handoff === null) return path
  const target = handoffTarget(handoff)
  return safeRedirectTarget(target, CHECK_ORIGIN) === `${CHECK_ORIGIN}${target}` ? target : path
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id') ?? undefined

  let displayName: string | undefined = undefined
  let effectiveWeight = 0
  // A signed-in citizen with no profile, on /profile/setup: the shell is the
  // wordmark and Sign out only (UI plan C3). Everywhere else they are sent here.
  let onboarding = false

  if (userId) {
    try {
      const db = getDb()

      const [profileRows, credentialResult] = await Promise.all([
        db
          .select({ displayName: userProfiles.displayName })
          .from(userProfiles)
          .where(eq(userProfiles.userId, userId))
          .limit(1),
        checkModeratorAccess(userId),
      ])

      effectiveWeight = credentialResult.effectiveWeight

      if (profileRows.length > 0) {
        displayName = profileRows[0].displayName
      } else {
        const currentPath =
          headersList.get('x-pathname') ?? '/investigate'

        if (!currentPath.startsWith('/profile/setup')) {
          const target = onboardingReturnTarget(currentPath, headersList.get('x-search') ?? '')
          redirect(`/profile/setup?redirect=${encodeURIComponent(target)}`)
        }
        onboarding = true
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'digest' in e) throw e
      // Shell chrome only: the page itself still renders and surfaces its own
      // errors. No invented name (it once showed "Dev User" in production);
      // with displayName unset the footer reads "Your profile" (Razor N2).
      // The error's name only: a driver message can echo query values (the user id).
      console.error('[app-layout] profile lookup failed:', e instanceof Error ? e.name : 'unknown error')
    }
  }

  return (
    <AppShell
      displayName={displayName}
      effectiveWeight={effectiveWeight}
      variant={onboarding ? 'onboarding' : 'app'}
    >
      {children}
    </AppShell>
  )
}
