import Link from 'next/link'
import { getDb } from '@/lib/db'
import { federalMps } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { PartyBadge } from '@/components/votes/party-badge'

export const metadata = {
  title: 'All MPs — The Republic',
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
  const parties = [...new Set(mps.map((m) => m.party))].sort()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1
          className="mb-2 text-xl font-bold tracking-tight text-text-primary"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          Members of Parliament
        </h1>
        <p className="text-xs text-text-muted">
          {mps.length} current MPs across {provinces.length} provinces and territories
        </p>
      </div>

      {mps.length === 0 ? (
        <div
          className="rounded-xl border px-6 py-10 text-center"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--surface-1)',
          }}
        >
          <p className="text-sm text-text-muted">
            No MP data available. Run a sync to populate parliamentary data.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mps.map((mp) => (
            <Link
              key={mp.id}
              href={`/votes/mp/${mp.id}`}
              className="group flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface-1)',
              }}
            >
              {mp.photoUrl ? (
                <img
                  src={mp.photoUrl}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-faint)' }}
                >
                  {mp.name.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary leading-tight truncate">
                  {mp.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <PartyBadge party={mp.party} />
                  <span className="text-[10px] text-text-faint">
                    {mp.ridingName}, {mp.ridingProvince}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
