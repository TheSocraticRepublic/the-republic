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
  const userId = headersList.get('x-user-id') ?? undefined

  let displayName: string | undefined = undefined
  let effectiveWeight = 0

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
          redirect(`/profile/setup?redirect=${encodeURIComponent(currentPath)}`)
        }
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
    <AppShell displayName={displayName} effectiveWeight={effectiveWeight}>
      {children}
    </AppShell>
  )
}
