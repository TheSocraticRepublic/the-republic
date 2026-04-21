import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { checkModeratorAccess } from '@/lib/credentials/check-moderator'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const userEmail = headersList.get('x-user-email') ?? undefined
  const userId = headersList.get('x-user-id') ?? undefined

  let displayName: string | undefined = undefined
  let effectiveWeight = 0

  if (userId) {
    const db = getDb()

    // W6: Profile lookup and credential weight query run in parallel via Promise.all,
    // so the overhead is the slower of the two queries, not their sum.
    // At scale this could be optimized further (e.g. caching effectiveWeight in the
    // session token), but the parallel pattern is acceptable for current traffic.
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
      // No profile — get the current path and redirect to setup
      // x-invoke-path is set by Next.js middleware internally
      const currentPath =
        headersList.get('x-invoke-path') ??
        headersList.get('x-pathname') ??
        '/investigate'

      if (!currentPath.startsWith('/profile/setup')) {
        redirect(`/profile/setup?redirect=${encodeURIComponent(currentPath)}`)
      }
    }
  }

  return (
    <AppShell userEmail={userEmail} displayName={displayName} effectiveWeight={effectiveWeight}>
      {children}
    </AppShell>
  )
}
