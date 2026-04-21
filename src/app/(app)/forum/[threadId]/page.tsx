import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { forumThreads, forumPosts, userProfiles, jurisdictions } from '@/lib/db/schema'
import { eq, asc, and, inArray } from 'drizzle-orm'
import { ThreadView } from '@/components/forum/thread-view'

interface PageProps {
  params: Promise<{ threadId: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { threadId } = await params
  const db = getDb()
  const rows = await db
    .select({ title: forumThreads.title })
    .from(forumThreads)
    .where(eq(forumThreads.id, threadId))
    .limit(1)
  const title = rows[0]?.title ?? 'Thread'
  return { title: `${title} — The Republic` }
}

export default async function ThreadPage({ params, searchParams }: PageProps) {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  if (!userId) redirect('/login')

  const { threadId } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const db = getDb()

  const threadRows = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      authorId: forumThreads.authorId,
      authorDisplayName: userProfiles.displayName,
      investigationId: forumThreads.investigationId,
      jurisdictionId: forumThreads.jurisdictionId,
      concernCategory: forumThreads.concernCategory,
      status: forumThreads.status,
      pinned: forumThreads.pinned,
      postCount: forumThreads.postCount,
      lastPostAt: forumThreads.lastPostAt,
      createdAt: forumThreads.createdAt,
      jurisdictionName: jurisdictions.name,
    })
    .from(forumThreads)
    .innerJoin(userProfiles, eq(forumThreads.authorId, userProfiles.userId))
    .leftJoin(jurisdictions, eq(forumThreads.jurisdictionId, jurisdictions.id))
    .where(eq(forumThreads.id, threadId))
    .limit(1)

  if (threadRows.length === 0) {
    notFound()
  }

  const thread = threadRows[0]

  const posts = await db
    .select({
      id: forumPosts.id,
      threadId: forumPosts.threadId,
      authorId: forumPosts.authorId,
      authorDisplayName: userProfiles.displayName,
      parentId: forumPosts.parentId,
      content: forumPosts.content,
      editedAt: forumPosts.editedAt,
      status: forumPosts.status,
      createdAt: forumPosts.createdAt,
      updatedAt: forumPosts.updatedAt,
    })
    .from(forumPosts)
    .innerJoin(userProfiles, eq(forumPosts.authorId, userProfiles.userId))
    .where(
      and(
        eq(forumPosts.threadId, threadId),
        inArray(forumPosts.status, ['visible', 'removed_by_author'])
      )
    )
    .orderBy(asc(forumPosts.createdAt))
    .limit(limit)
    .offset(offset)

  const pagination = {
    page,
    limit,
    total: thread.postCount,
    totalPages: Math.ceil(thread.postCount / limit),
  }

  return (
    <ThreadView
      thread={thread}
      initialPosts={posts}
      currentUserId={userId}
      initialPagination={pagination}
    />
  )
}
