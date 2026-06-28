'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { POST_CONTENT_MAX } from '@/lib/forum/validation'

interface PostComposerProps {
  threadId: string
  parentId?: string | null
  onPostCreated: (post: unknown) => void
  onCancel?: () => void
  placeholder?: string
}

export function PostComposer({
  threadId,
  parentId,
  onPostCreated,
  onCancel,
  placeholder = 'Write your thoughts...',
}: PostComposerProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const charCount = content.length
  const isOverLimit = charCount > POST_CONTENT_MAX

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || isOverLimit) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/forum/threads/${threadId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId: parentId ?? null }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to post')
      }

      const data = await res.json()
      setContent('')
      onPostCreated(data.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder || 'Post content'}
        rows={parentId ? 3 : 5}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-text-primary bg-surface-1 border border-border-strong placeholder-text-faint resize-none focus:outline-none focus:border-border-strong transition-colors"
      />
      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${isOverLimit ? 'text-red-400' : 'text-text-faint'}`}>
          {charCount}/{POST_CONTENT_MAX}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-text-faint hover:text-text-secondary transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !content.trim() || isOverLimit}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {loading && <Loader2 size={11} className="animate-spin" />}
            {parentId ? 'Reply' : 'Post'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
