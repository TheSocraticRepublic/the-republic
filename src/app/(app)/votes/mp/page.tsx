import { getDb } from '@/lib/db'
import { federalMps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { MpListFilter } from '@/components/votes/mp-list-filter'
import { EmptyState } from '@/components/ui/empty-state'
import { DetailHeader } from '@/components/layout/detail-header'
import { DataFreshnessBadge } from '@/components/votes/data-freshness-badge'


export const metadata = {
  title: 'All MPs',
}

export default async function AllMPsPage() {
  const db = getDb()

  const mps = await db
    .select({
      id: federalMps.id,
      name: federalMps.name,
      party: federalMps.party,
      ridingName: federalMps.ridingName,
      ridingProvince: federalMps.ridingProvince,
      photoUrl: federalMps.photoUrl,
    })
    .from(federalMps)
    .where(eq(federalMps.active, true))
    .orderBy(asc(federalMps.name))

  const provinces = [...new Set(mps.map((m) => m.ridingProvince))].sort()

  return (
    <div data-arm="votes">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <DetailHeader
          arm="votes"
          backHref="/votes"
          backLabel="Back to Vote Tracker"
          title="Members of Parliament"
          meta={
            <>
              <span>
                {mps.length} current MPs across {provinces.length} provinces and territories
              </span>
              <DataFreshnessBadge variant="meta" />
            </>
          }
        />

        {mps.length === 0 ? (
          <EmptyState message="No MP data yet. This deployment hasn’t synced with Parliament." />
        ) : (
          <MpListFilter mps={mps} provinces={provinces} />
        )}
      </div>
    </div>
  )
}
