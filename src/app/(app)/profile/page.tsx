import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

export const metadata = {
  title: 'Profile — The Republic',
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export default async function ProfilePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/login')

  const db = getDb()
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  if (rows.length === 0) {
    redirect('/profile/setup')
  }

  const profile = rows[0]

  // Fetch credential breakdown directly from DB (server component)
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
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-xl font-bold tracking-tight text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Profile
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500">Your public identity</p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-white/[0.08] bg-black/50 p-6 backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
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

          <Link
            href="/profile/setup"
            className="flex-shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-neutral-200"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Public link note */}
      <p className="mt-4 text-xs text-neutral-700">
        Your public profile is visible at{' '}
        <Link
          href={`/u/${profile.displayName}`}
          className="text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-300"
        >
          /u/{profile.displayName}
        </Link>
      </p>

      {/* Credential breakdown */}
      <div className="mt-6">
        <CredentialBreakdown summary={credentialSummary} />
      </div>
    </div>
  )
}
