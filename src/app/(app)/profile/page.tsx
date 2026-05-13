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
  title: 'Profile',
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
          className="text-xl font-bold tracking-tight text-text-primary"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Profile
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">Your public identity</p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <ProfileBadge displayName={profile.displayName} size="md" />
            {profile.bio && (
              <p className="max-w-md text-sm leading-relaxed text-text-secondary">
                {profile.bio}
              </p>
            )}
            <p className="text-xs text-text-faint">
              Joined {formatDate(profile.createdAt)}
            </p>
          </div>

          <Link
            href="/profile/setup"
            className="flex-shrink-0 rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Public link note */}
      <p className="mt-4 text-xs text-text-faint">
        Your public profile is visible at{' '}
        <Link
          href={`/u/${profile.displayName}`}
          className="text-text-muted underline underline-offset-2 transition-colors hover:text-text-secondary"
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
