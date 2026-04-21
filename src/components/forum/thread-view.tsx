'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Flag } from 'lucide-react'
import { ProfileBadge } from '@/components/profile/profile-badge'
import { PostCard } from './post-card'
import { PostComposer } from './post-composer'
import { Pagination } from './pagination'
import { ReportForm } from './report-form'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { MAX_REPLY_DEPTH } from '@/lib/forum/validation'

interface PostData {
  id: string
  threadId: string
  authorId: string
  authorDisplayName: string
  parentId: string | null
  content: string | null
  editedAt: Date | string | null
  status: 'visible' | 'hidden' | 'removed_by_author'
  createdAt: Date | string
  updatedAt: Date | string
  // W8/N1: reportId is present on hidden posts so the appeal endpoint receives
  // the correct ID (appeals are filed against a report, not directly against a post).
  reportId?: string | null
}

interface PostNode extends PostData {
  depth: number
  children: PostNode[]
}

interface ThreadData {
  id: string
  title: string
  authorId: string  // needed for thread report gate
  authorDisplayName: string
  investigationId: string | null
  jurisdictionName: string | null
  concernCategory: string | null
  status: 'open' | 'locked' | 'archived'
  pinned: boolean
  postCount: number
  lastPostAt: Date | string | null
  createdAt: Date | string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ThreadViewProps {
  thread: ThreadData
  initialPosts: PostData[]
  currentUserId: string
  initialPagination: PaginationData
}

function buildTree(posts: PostData[]): PostNode[] {
  const map = new Map<string, PostNode>()

  // First pass: create nodes
  for (const post of posts) {
    map.set(post.id, { ...post, depth: 0, children: [] })
  }

  const roots: PostNode[] = []

  // Second pass: attach children and compute depth
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function renderNodes(
  nodes: PostNode[],
  props: {
    currentUserId: string
    threadStatus: 'open' | 'locked' | 'archived'
    replyingToPostId: string | null
    threadId: string
    onReply: (postId: string) => void
    onCancelReply: () => void
    onPostCreated: (post: PostData, parentId: string | null) => void
    onEdit: (postId: string, newContent: string) => Promise<void>
    onDelete: (postId: string) => Promise<void>
  }
): React.ReactNode[] {
  const elements: React.ReactNode[] = []

  for (const node of nodes) {
    elements.push(
      <div key={node.id}>
        <PostCard
          id={node.id}
          authorId={node.authorId}
          authorDisplayName={node.authorDisplayName}
          content={node.content}
          editedAt={node.editedAt}
          status={node.status}
          createdAt={node.createdAt}
          parentId={node.parentId}
          depth={node.depth}
          currentUserId={props.currentUserId}
          threadStatus={props.threadStatus}
          reportId={node.reportId ?? undefined}
          onReply={node.depth < MAX_REPLY_DEPTH ? props.onReply : undefined}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />
        {props.replyingToPostId === node.id && (
          <div style={{ marginLeft: (node.depth + 1) * 24 }} className="mt-2">
            <PostComposer
              threadId={props.threadId}
              parentId={node.id}
              placeholder="Write a reply..."
              onPostCreated={(post) => props.onPostCreated(post as PostData, node.id)}
              onCancel={props.onCancelReply}
            />
          </div>
        )}
        {node.children.length > 0 && (
          <div className="mt-2 space-y-2">
            {renderNodes(node.children, props)}
          </div>
        )}
      </div>
    )
  }

  return elements
}

export function ThreadView({
  thread,
  initialPosts,
  currentUserId,
  initialPagination,
}: ThreadViewProps) {
  const [posts, setPosts] = useState<PostData[]>(initialPosts)
  const [replyingToPostId, setReplyingToPostId] = useState<string | null>(null)
  const [reportingThread, setReportingThread] = useState(false)
  const [threadReported, setThreadReported] = useState(false)

  const handleReply = useCallback((postId: string) => {
    setReplyingToPostId(postId)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyingToPostId(null)
  }, [])

  const handlePostCreated = useCallback((post: PostData, _parentId: string | null) => {
    setPosts((prev) => [...prev, post])
    setReplyingToPostId(null)
  }, [])

  const handleTopLevelPost = useCallback((post: unknown) => {
    setPosts((prev) => [...prev, post as PostData])
  }, [])

  const handleEdit = useCallback(async (postId: string, newContent: string) => {
    const res = await fetch(`/api/forum/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to edit post')
    }
    const data = await res.json()
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, content: newContent, editedAt: data.post.editedAt } : p))
    )
  }, [])

  const handleDelete = useCallback(async (postId: string) => {
    const res = await fetch(`/api/forum/posts/${postId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to delete post')
    }
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: 'removed_by_author' as const } : p))
    )
  }, [])

  const tree = buildTree(posts)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Thread header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100 mb-3"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {thread.title}
          </h1>
          {thread.authorId !== currentUserId && !threadReported && (
            <button
              onClick={() => setReportingThread((v) => !v)}
              className="flex-shrink-0 flex items-center gap-1 text-xs text-neutral-700 hover:text-neutral-400 transition-colors mt-1"
              title="Report this thread"
            >
              <Flag size={12} strokeWidth={1.75} />
              <span className="sr-only">Report</span>
            </button>
          )}
          {threadReported && (
            <span className="flex-shrink-0 text-xs text-neutral-600 mt-1">Reported</span>
          )}
        </div>
        {reportingThread && (
          <div className="mb-4">
            <ReportForm
              targetType="thread"
              targetId={thread.id}
              onSubmitted={() => { setReportingThread(false); setThreadReported(true) }}
              onCancel={() => setReportingThread(false)}
            />
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <ProfileBadge displayName={thread.authorDisplayName} size="sm" />
          <span>{formatRelativeTime(thread.createdAt)}</span>
          {thread.investigationId && (
            <Link
              href={`/investigate/${thread.investigationId}`}
              className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
            >
              View investigation
            </Link>
          )}
        </div>
        {thread.status !== 'open' && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs text-neutral-500"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            This thread is {thread.status === 'locked' ? 'locked' : 'archived'} and no longer accepts replies.
          </div>
        )}
      </div>

      {/* Post tree */}
      <div className="space-y-2">
        {renderNodes(tree, {
          currentUserId,
          threadStatus: thread.status,
          replyingToPostId,
          threadId: thread.id,
          onReply: handleReply,
          onCancelReply: handleCancelReply,
          onPostCreated: handlePostCreated,
          onEdit: handleEdit,
          onDelete: handleDelete,
        })}
      </div>

      {/* Pagination */}
      {initialPagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={initialPagination.page}
            totalPages={initialPagination.totalPages}
            baseUrl={`/forum/${thread.id}`}
          />
        </div>
      )}

      {/* Top-level composer */}
      {thread.status === 'open' && (
        <div className="mt-8 space-y-3">
          <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <PostComposer
            threadId={thread.id}
            onPostCreated={handleTopLevelPost}
            placeholder="Add to the discussion..."
          />
        </div>
      )}
    </div>
  )
}
