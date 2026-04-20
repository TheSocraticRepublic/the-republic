import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const userEmail = headersList.get('x-user-email') ?? undefined
  const userId = headersList.get('x-user-id') ?? undefined

  let displayName: string | undefined = undefined

  if (userId) {
    const db = getDb()
    const rows = await db
      .select({ displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    if (rows.length > 0) {
      displayName = rows[0].displayName
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
    <AppShell userEmail={userEmail} displayName={displayName}>
      {children}
    </AppShell>
  )
}
