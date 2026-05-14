import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { userProfiles, credentialEvents } from '@/lib/db/schema'
import { eq, count, sum, sql } from 'drizzle-orm'
import { ProfileBadge } from '@/components/profile/profile-badge'
import { CredentialBreakdown } from '@/components/credentials/credential-breakdown'
import {
  CREDENTIAL_LABELS,
  computeDecayMultiplier,
  computeEffectiveWeight,
  type CredentialType,
} from '@/lib/credentials'

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
    title: displayName,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { displayName } = await params

  const db = getDb()

  // Look up profile by displayName
  const profileRows = await db
    .select({
      userId: userProfiles.userId,
      displayName: userProfiles.displayName,
      bio: userProfiles.bio,
      avatarUrl: userProfiles.avatarUrl,
      createdAt: userProfiles.createdAt,
    })
    .from(userProfiles)
    .where(eq(userProfiles.displayName, displayName))
    .limit(1)

  if (profileRows.length === 0) {
    notFound()
  }

  const profile = profileRows[0]
  const userId = profile.userId

  // Full credential computation — decay-adjusted for public display
  const [breakdownRows, lastActivityRows] = await Promise.all([
    db
      .select({
        type: credentialEvents.credentialType,
        count: count(),
        rawWeight: sum(credentialEvents.weight),
      })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId))
      .groupBy(credentialEvents.credentialType),
    db
      .select({ lastActivity: sql<string>`MAX(created_at)` })
      .from(credentialEvents)
      .where(eq(credentialEvents.userId, userId)),
  ])

  const lastActivityStr = lastActivityRows[0]?.lastActivity ?? null
  const lastActivityAt = lastActivityStr ? new Date(lastActivityStr) : null
  const rawTotal = breakdownRows.reduce((acc, row) => acc + Number(row.rawWeight ?? 0), 0)
  const decayMultiplier = computeDecayMultiplier(lastActivityAt)
  const effectiveTotal = computeEffectiveWeight(rawTotal, lastActivityAt)

  const credentialSummary = {
    rawTotal,
    effectiveTotal,
    decayMultiplier,
    lastActivityAt,
    breakdown: breakdownRows.map((row) => ({
      type: row.type as CredentialType,
      label: CREDENTIAL_LABELS[row.type as CredentialType],
      count: Number(row.count),
      rawWeight: Number(row.rawWeight ?? 0),
    })),
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Profile card */}
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-6">
        <div className="flex flex-col gap-4">
          <ProfileBadge displayName={profile.displayName} size="md" />

          {profile.bio && (
            <p className="max-w-md text-sm leading-relaxed text-text-secondary">
              {profile.bio}
            </p>
          )}

          <div className="flex items-center gap-3">
            <p className="text-xs text-text-faint">
              Joined {formatDate(profile.createdAt)}
            </p>
            {effectiveTotal > 0 && (
              <>
                <span className="text-text-faint">·</span>
                <p className="text-xs text-text-muted">
                  Civic weight{' '}
                  <span className="text-text-secondary font-medium">{effectiveTotal}</span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Credential breakdown */}
      <div className="mt-6">
        <CredentialBreakdown summary={credentialSummary} />
      </div>
    </div>
  )
}
