import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { forumThreads, userProfiles, jurisdictions } from '@/lib/db/schema'
import { eq, desc, and, count, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ThreadCard } from '@/components/forum/thread-card'
import { ThreadFilters } from '@/components/forum/thread-filters'
import { Pagination } from '@/components/forum/pagination'

export const metadata = {
  title: 'Forum — The Republic',
}

interface SearchParams {
  page?: string
  jurisdiction?: string
  category?: string
  investigation?: string
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/login')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const limit = 20
  const offset = (page - 1) * limit
  const jurisdictionParam = sp.jurisdiction ?? null
  const categoryParam = sp.category ?? null
  const investigationParam = sp.investigation ?? null

  const db = getDb()

  const conditions = [eq(forumThreads.status, 'open')]
  if (jurisdictionParam) {
    conditions.push(eq(forumThreads.jurisdictionId, jurisdictionParam))
  }
  if (categoryParam) {
    conditions.push(eq(forumThreads.concernCategory, categoryParam))
  }
  if (investigationParam) {
    conditions.push(eq(forumThreads.investigationId, investigationParam))
  }

  const whereClause = and(...conditions)

  const [threads, totalResult, allJurisdictions] = await Promise.all([
    db
      .select({
        id: forumThreads.id,
        title: forumThreads.title,
        investigationId: forumThreads.investigationId,
        jurisdictionId: forumThreads.jurisdictionId,
        concernCategory: forumThreads.concernCategory,
        status: forumThreads.status,
        pinned: forumThreads.pinned,
        postCount: forumThreads.postCount,
        lastPostAt: forumThreads.lastPostAt,
        createdAt: forumThreads.createdAt,
        authorDisplayName: userProfiles.displayName,
        jurisdictionName: jurisdictions.name,
      })
      .from(forumThreads)
      .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
      .leftJoin(jurisdictions, eq(forumThreads.jurisdictionId, jurisdictions.id))
      .where(whereClause)
      .orderBy(desc(forumThreads.pinned), desc(sql`${forumThreads.lastPostAt} NULLS LAST`))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(forumThreads).where(whereClause),
    db.select({ id: jurisdictions.id, name: jurisdictions.name }).from(jurisdictions).orderBy(jurisdictions.name),
  ])

  const total = totalResult[0]?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const queryParams: Record<string, string> = {}
  if (jurisdictionParam) queryParams.jurisdiction = jurisdictionParam
  if (categoryParam) queryParams.category = categoryParam

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Forum
            {total > 0 && (
              <span className="ml-2.5 text-sm font-normal text-neutral-500">{total}</span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500">Community discussions</p>
        </div>
        <Link
          href="/forum/new"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:opacity-90"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#f4f4f5',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}
        >
          <Plus size={13} strokeWidth={2} />
          New Thread
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <ThreadFilters
          currentJurisdiction={jurisdictionParam}
          currentCategory={categoryParam}
          jurisdictions={allJurisdictions}
        />
      </div>

      {/* Thread list */}
      <section>
        {threads.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">No discussions yet. Be the first to start one.</p>
            <p className="mt-2">
              <Link
                href="/forum/new"
                className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200 transition-colors"
              >
                Start a discussion
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                id={thread.id}
                title={thread.title}
                authorDisplayName={thread.authorDisplayName}
                postCount={thread.postCount}
                lastPostAt={thread.lastPostAt}
                jurisdictionName={thread.jurisdictionName}
                concernCategory={thread.concernCategory}
                pinned={thread.pinned}
                status={thread.status}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl="/forum"
          queryParams={queryParams}
        />
      )}
    </div>
  )
}
