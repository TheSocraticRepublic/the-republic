import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { userProfiles, investigations, peerReviews, credentialEvents } from '@/lib/db/schema'
import { eq, and, count, sum } from 'drizzle-orm'
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

  // Aggregate stats in parallel
  const [investigationResult, reviewResult, weightResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(investigations)
      .where(and(eq(investigations.userId, userId), eq(investigations.status, 'active'))),
    db
      .select({ count: count() })
      .from(peerReviews)
      .where(eq(peerReviews.reviewerId, userId)),
    db
      .select({ total: sum(credentialEvents.weight) })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const investigationCount = Number(investigationResult[0]?.count ?? 0)
  const reviewCount = Number(reviewResult[0]?.count ?? 0)
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

          <p className="text-xs text-neutral-600">
            Joined {formatDate(profile.createdAt)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-4 text-center">
          <p
            className="text-2xl font-bold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {investigationCount}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-600">Investigations</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-4 text-center">
          <p
            className="text-2xl font-bold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {reviewCount}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-600">Reviews</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/40 px-4 py-4 text-center">
          <p
            className="text-2xl font-bold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {credentialWeight}
          </p>
          <p className="mt-0.5 text-[11px] text-neutral-600">Civic weight</p>
        </div>
      </div>
    </div>
  )
}
