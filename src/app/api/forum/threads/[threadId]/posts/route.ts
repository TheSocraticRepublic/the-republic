import { NextRequest, after } from 'next/server'
import { getDb } from '@/lib/db'
import { forumThreads, forumPosts, userProfiles, remoteFollowers } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { stripHtmlTags } from '@/lib/profile/validation'
import { validatePostContent, MAX_REPLY_DEPTH } from '@/lib/forum/validation'
import { checkRateLimit } from '@/lib/rate-limit'
import { isFederationConfigured, postUrl } from '@/lib/activitypub/context'
import { getOrCreateActorKeys } from '@/lib/activitypub/keys'
import { deliverActivity, buildKeyId } from '@/lib/activitypub/delivery'
import { postToNote, wrapInCreate } from '@/lib/activitypub/activity'

interface RouteContext {
  params: Promise<{ threadId: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`forum-post:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { threadId } = await params

  let body: { content?: unknown; parentId?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawContent = typeof body.content === 'string' ? body.content : ''
  const parentId = typeof body.parentId === 'string' ? body.parentId : null

  const contentStripped = stripHtmlTags(rawContent)
  const contentValidation = validatePostContent(contentStripped)
  if (!contentValidation.valid) {
    return new Response(JSON.stringify({ error: contentValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Verify thread exists and is open
  const threadRows = await db
    .select({ id: forumThreads.id, status: forumThreads.status })
    .from(forumThreads)
    .where(eq(forumThreads.id, threadId))
    .limit(1)

  if (threadRows.length === 0) {
    return new Response(JSON.stringify({ error: 'Thread not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const thread = threadRows[0]
  if (thread.status !== 'open') {
    return new Response(JSON.stringify({ error: 'This thread is closed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate parent post and check depth
  if (parentId) {
    const parentRows = await db
      .select({ id: forumPosts.id, threadId: forumPosts.threadId, parentId: forumPosts.parentId })
      .from(forumPosts)
      .where(and(eq(forumPosts.id, parentId), eq(forumPosts.threadId, threadId)))
      .limit(1)

    if (parentRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Parent post not found in this thread' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Walk the chain to determine depth (up to 4 hops)
    let depth = 1
    let currentParentId: string | null = parentRows[0].parentId
    for (let i = 0; i < 3 && currentParentId !== null; i++) {
      depth++
      const ancestorRows = await db
        .select({ parentId: forumPosts.parentId })
        .from(forumPosts)
        .where(eq(forumPosts.id, currentParentId))
        .limit(1)
      if (ancestorRows.length === 0) break
      currentParentId = ancestorRows[0].parentId
    }

    if (depth > MAX_REPLY_DEPTH) {
      return new Response(JSON.stringify({ error: 'Maximum reply depth reached' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(forumPosts)
        .values({
          threadId,
          authorId: userId,
          content: contentStripped,
          parentId,
        })
        .returning()

      await tx
        .update(forumThreads)
        .set({
          postCount: sql`post_count + 1`,
          lastPostAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(forumThreads.id, threadId))

      return { post }
    })

    // Deliver to Fediverse followers after the response is sent.
    // after() runs the callback post-response without blocking the client and
    // without being killed when the handler returns — safe for async fan-out.
    if (isFederationConfigured()) {
      after(async () => {
        await deliverPostToFollowers(userId, result.post, parentId).catch((err) => {
          console.error('[AP] Error in post delivery background task', err)
        })
      })
    }

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Failed to create forum post', err)
    return new Response(JSON.stringify({ error: 'Failed to create post' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function deliverPostToFollowers(
  userId: string,
  post: { id: string; content: string; threadId: string; createdAt: Date },
  parentId: string | null
) {
  const db = getDb()

  const [profileRows, followerRows] = await Promise.all([
    db
      .select({ apHandle: userProfiles.apHandle })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1),
    db
      .select({
        actorInbox: remoteFollowers.actorInbox,
        sharedInbox: remoteFollowers.sharedInbox,
      })
      .from(remoteFollowers)
      .where(eq(remoteFollowers.userId, userId)),
  ])

  const apHandle = profileRows[0]?.apHandle
  if (!apHandle || followerRows.length === 0) return

  let privateKeyPem: string
  try {
    const keys = await getOrCreateActorKeys(userId)
    privateKeyPem = keys.privateKeyPem
  } catch (err) {
    console.error('[AP] Could not get actor keys for post delivery', err)
    return
  }

  const keyId = buildKeyId(apHandle)

  const note = postToNote({
    id: post.id,
    content: post.content,
    authorApHandle: apHandle,
    createdAt: post.createdAt,
    parentPostId: parentId,
    threadId: post.threadId,
  })

  const activityId = `${postUrl(post.id)}/activity`
  const activity = wrapInCreate(note, apHandle, activityId)

  // Deduplicate by sharedInbox where available
  const inboxSet = new Set<string>()
  for (const follower of followerRows) {
    inboxSet.add(follower.sharedInbox ?? follower.actorInbox)
  }

  for (const inbox of inboxSet) {
    deliverActivity(activity, inbox, privateKeyPem, keyId).catch((err) => {
      console.error(`[AP] Failed to deliver post to ${inbox}`, err)
    })
  }
}
