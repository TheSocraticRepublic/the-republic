import { AP_CONTEXT, actorUrl, threadUrl, postUrl } from './context'

// --- Types ---

export interface ApActivity {
  '@context': unknown
  id: string
  type: string
  actor: string
  object: unknown
}

export interface ApCreate extends ApActivity {
  type: 'Create'
  to: string[]
  cc: string[]
}

export interface ApNote {
  '@context': unknown
  id: string
  type: 'Note'
  mediaType: 'text/plain'
  attributedTo: string
  content: string
  inReplyTo?: string
  published: string
  to: string[]
  cc: string[]
}

export interface ApArticle {
  '@context': unknown
  id: string
  type: 'Article'
  mediaType: 'text/plain'
  attributedTo: string
  name: string
  content: string
  published: string
  to: string[]
  cc: string[]
  url: string
}

// --- Activity builders ---

/**
 * Wraps an AP object in a Create activity.
 */
export function wrapInCreate(
  object: ApNote | ApArticle,
  actorApHandle: string,
  activityId: string
): ApCreate {
  const actor = actorUrl(actorApHandle)
  return {
    '@context': AP_CONTEXT,
    id: activityId,
    type: 'Create',
    actor,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actor}/followers`],
    object,
  }
}

/**
 * Converts a forum thread to an AP Article.
 */
export function threadToArticle(thread: {
  id: string
  title: string
  content: string
  authorApHandle: string
  createdAt: Date
}): ApArticle {
  const id = threadUrl(thread.id)
  const actor = actorUrl(thread.authorApHandle)
  return {
    '@context': AP_CONTEXT,
    id,
    type: 'Article',
    mediaType: 'text/plain' as const,
    attributedTo: actor,
    name: thread.title,
    content: thread.content,
    published: thread.createdAt.toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actor}/followers`],
    url: id,
  }
}

/**
 * Converts a forum post to an AP Note.
 */
export function postToNote(post: {
  id: string
  content: string
  authorApHandle: string
  createdAt: Date
  parentPostId?: string | null
  threadId: string
}): ApNote {
  const id = postUrl(post.id)
  const actor = actorUrl(post.authorApHandle)
  const note: ApNote = {
    '@context': AP_CONTEXT,
    id,
    type: 'Note',
    mediaType: 'text/plain',
    attributedTo: actor,
    content: post.content,
    published: post.createdAt.toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${actor}/followers`],
  }

  if (post.parentPostId) {
    note.inReplyTo = postUrl(post.parentPostId)
  }

  return note
}
