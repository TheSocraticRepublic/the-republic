import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { userProfiles, credentialEvents } from '@/lib/db/schema'
import { eq, sum } from 'drizzle-orm'
import { ProfileBadge } from '@/components/profile/profile-badge'

interface PageProps {
  params: Promise<{ displayName: string }>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export async function generateMetadata({ params }: PageProps) {
  const { displayName } = await params
  return {
    title: `${displayName} — The Republic`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { displayName } = await params

  const db = getDb()

  // Look up profile by displayName
  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.displayName, displayName))
    .limit(1)

  if (profileRows.length === 0) {
    notFound()
  }

  const profile = profileRows[0]
  const userId = profile.userId

  // Query credential weight only — investigation and review counts are engagement
  // metrics inconsistent with anti-spectacle principles
  const [weightResult] = await Promise.all([
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const credentialWeight = Number(weightResult[0]?.total ?? 0)

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Profile card */}
      <div className="rounded-xl border border-white/[0.08] bg-black/50 p-6 backdrop-blur-md">
        <div className="flex flex-col gap-4">
          <ProfileBadge displayName={profile.displayName} size="md" />

          {profile.bio && (
            <p className="max-w-md text-sm leading-relaxed text-neutral-400">
              {profile.bio}
            </p>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs text-neutral-600">
              Joined {formatDate(profile.createdAt)}
            </p>
            {credentialWeight > 0 && (
              <>
                <span className="text-neutral-800">·</span>
                <p className="text-xs text-neutral-500">
                  Civic weight{' '}
                  <span className="text-neutral-300 font-medium">{credentialWeight}</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
