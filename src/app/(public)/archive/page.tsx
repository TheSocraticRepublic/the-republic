import { getDb } from '@/lib/db'
import { archiveRecords, investigations, userProfiles } from '@/lib/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { ArchiveCard } from '@/components/archive/archive-card'
import { Pagination } from '@/components/forum/pagination'

export const metadata = {
  title: 'The Archive — The Republic',
}

const PAGE_SIZE = 50

interface SearchParams {
  page?: string
}

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  const db = getDb()

  const [records, totalResult] = await Promise.all([
    db
      .select({
        investigationId: archiveRecords.investigationId,
        archiveStatus: archiveRecords.archiveStatus,
        ipfsCid: archiveRecords.ipfsCid,
        preservedAt: archiveRecords.preservedAt,
        concern: investigations.concern,
        jurisdictionName: investigations.jurisdictionName,
        archivedBy: userProfiles.displayName,
      })
      .from(archiveRecords)
      .innerJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
      .innerJoin(userProfiles, eq(archiveRecords.userId, userProfiles.userId))
      .orderBy(desc(archiveRecords.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(archiveRecords),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      {/* Header */}
      <div className="mb-10">
        <h1
          className="text-xl font-bold tracking-tight text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          The Archive
          {total > 0 && (
            <span className="ml-2.5 text-sm font-normal text-neutral-500">
              {total}
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-xs text-neutral-500">
          Preserved civic investigations. Public, permanent, unforgeable.
        </p>
      </div>

      {/* List */}
      <section>
        {records.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No investigations have been archived yet.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Archived investigations are preserved permanently and will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {records.map((record) => (
                <ArchiveCard
                  key={record.investigationId}
                  investigationId={record.investigationId}
                  concern={record.concern}
                  jurisdictionName={record.jurisdictionName ?? null}
                  preservedAt={record.preservedAt ?? new Date(0)}
                  archiveStatus={record.archiveStatus}
                  ipfsCid={record.ipfsCid ?? null}
                  archivedBy={record.archivedBy}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  baseUrl="/archive"
                />
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
