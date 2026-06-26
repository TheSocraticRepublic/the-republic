'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  THREAD_TITLE_MAX,
  POST_CONTENT_MAX,
} from '@/lib/forum/validation'

function NewThreadForm() {
  const searchParams = useSearchParams()
  const investigationId = searchParams.get('investigationId')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill title when coming from an investigation
  useEffect(() => {
    if (investigationId) {
      fetch(`/api/investigate/${investigationId}`, {
        headers: { 'Content-Type': 'application/json' },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.investigation?.concern) {
            const snippet = data.investigation.concern.slice(0, 80).trim()
            setTitle(`Discussion: ${snippet}`)
          }
        })
        .catch(() => {}) // non-fatal
    }
  }, [investigationId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          investigationId: investigationId ?? undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create thread')
      }

      const data = await res.json()
      window.location.href = `/forum/${data.thread.id}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg px-3 py-2.5 text-sm text-text-primary bg-surface-1 border border-border-strong placeholder-text-faint focus:outline-none focus:border-border-strong transition-colors'

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-xl font-bold tracking-tight text-text-primary"
        >
          New Thread
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">Start a community discussion</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface-1 shadow-sm p-6 backdrop-blur-md space-y-5"
      >
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={THREAD_TITLE_MAX}
            placeholder="What do you want to discuss?"
            required
            className={inputClass}
          />
          <p className="text-[10px] text-text-faint text-right">
            {title.length}/{THREAD_TITLE_MAX}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={POST_CONTENT_MAX}
            placeholder="Provide context, background, or your question..."
            required
            rows={8}
            className={`${inputClass} resize-none`}
          />
          <p className="text-[10px] text-text-faint text-right">
            {content.length}/{POST_CONTENT_MAX}
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Link
            href="/forum"
            className="text-xs text-text-faint hover:text-text-secondary transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !content.trim()}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--surface-3)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Post Thread
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewThreadPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-xl border border-border bg-surface-1 px-6 py-10 text-center">
            <p className="text-sm text-text-muted">Loading...</p>
          </div>
        </div>
      }
    >
      <NewThreadForm />
    </Suspense>
  )
}
