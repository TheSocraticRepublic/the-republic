import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { forumThreads, userProfiles, jurisdictions } from '@/lib/db/schema'
import { eq, desc, and, count, sql } from 'drizzle-orm'
import { Plus } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { CTAButton } from '@/components/ui/cta-button'
import { ThreadCard } from '@/components/forum/thread-card'
import { ThreadFilters } from '@/components/forum/thread-filters'
import { Pagination } from '@/components/forum/pagination'

export const metadata = {
  title: 'Forum',
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
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            Forum
            {total > 0 && (
              <span className="ml-2.5 text-sm font-normal text-text-muted">{total}</span>
            )}
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">Community discussions</p>
        </div>
        <CTAButton href="/forum/new">
          <Plus size={13} strokeWidth={2} />
          New Thread
        </CTAButton>
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
          <EmptyState
            message="Someone has to speak first."
            action={{ label: 'Start a discussion', href: '/forum/new' }}
          />
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
