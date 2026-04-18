'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Pencil, RefreshCw, Check, X, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { leverActionTypeEnum } from '@/lib/db/schema'

type LeverActionType = (typeof leverActionTypeEnum.enumValues)[number]

interface ActionViewerProps {
  actionId: string
  initialContent: string
  initialStatus: 'draft' | 'final' | 'filed'
  actionType: LeverActionType
}

type ViewMode = 'generating' | 'viewing' | 'editing'

const STATUS_FLOW: Record<string, 'draft' | 'final' | 'filed'> = {
  draft: 'final',
  final: 'filed',
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', color: '#C8A84B', bg: 'rgba(200, 168, 75, 0.1)', border: 'rgba(200, 168, 75, 0.25)' },
  final: { label: 'Final', color: '#5BC88A', bg: 'rgba(91, 200, 138, 0.1)', border: 'rgba(91, 200, 138, 0.25)' },
  filed: { label: 'Filed', color: '#89B4C8', bg: 'rgba(137, 180, 200, 0.1)', border: 'rgba(137, 180, 200, 0.25)' },
}

const ADVANCE_LABELS: Record<string, string> = {
  draft: 'Mark as Final',
  final: 'Mark as Filed',
}

export function ActionViewer({ actionId, initialContent, initialStatus, actionType }: ActionViewerProps) {
  const [content, setContent] = useState(initialContent)
  const [editContent, setEditContent] = useState(initialContent)
  const [status, setStatus] = useState<'draft' | 'final' | 'filed'>(initialStatus)
  const [mode, setMode] = useState<ViewMode>(initialContent ? 'viewing' : 'generating')
  const [streamedContent, setStreamedContent] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)

  // Auto-generate if no content on mount
  useEffect(() => {
    if (!initialContent) {
      void runGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runGenerate = useCallback(async () => {
    setMode('generating')
    setStreamedContent('')

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/lever/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error('Generation failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamedContent(accumulated)
      }

      setContent(accumulated)
      setEditContent(accumulated)
      setMode('viewing')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[action-viewer] Generate failed:', err)
        setMode('viewing')
      }
    }
  }, [actionId])

  const handleAdvanceStatus = useCallback(async () => {
    const next = STATUS_FLOW[status]
    if (!next) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/lever/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setStatus(next)
    } catch (err) {
      console.error('[action-viewer] Status update failed:', err)
    } finally {
      setStatusUpdating(false)
    }
  }, [actionId, status])

  const handleSaveEdit = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/lever/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setContent(editContent)
      setMode('viewing')
    } catch (err) {
      console.error('[action-viewer] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [actionId, editContent])

  const handleCancelEdit = useCallback(() => {
    setEditContent(content)
    setMode('viewing')
  }, [content])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/lever/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId }),
      })
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : 'action.txt'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[action-viewer] Export failed:', err)
    } finally {
      setExporting(false)
    }
  }, [actionId])

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  const displayContent = mode === 'generating' ? streamedContent : content
  const nextStatus = STATUS_FLOW[status]

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status badge */}
        <span
          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ color: statusStyle.color, backgroundColor: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
        >
          {statusStyle.label}
        </span>

        <div className="flex-1" />

        {mode === 'viewing' && (
          <>
            {/* Advance status */}
            {nextStatus && (
              <button
                onClick={handleAdvanceStatus}
                disabled={statusUpdating}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                  statusUpdating ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'
                )}
                style={{
                  backgroundColor: 'rgba(91, 200, 138, 0.1)',
                  color: '#5BC88A',
                  border: '1px solid rgba(91, 200, 138, 0.2)',
                }}
              >
                <Check size={12} strokeWidth={2} />
                {ADVANCE_LABELS[status]}
              </button>
            )}

            {/* Edit */}
            <button
              onClick={() => { setEditContent(content); setMode('editing') }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200 border border-white/[0.08] hover:border-white/[0.15]"
            >
              <Pencil size={12} strokeWidth={2} />
              Edit
            </button>

            {/* Re-generate */}
            <button
              onClick={runGenerate}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200 border border-white/[0.08] hover:border-white/[0.15]"
            >
              <RefreshCw size={12} strokeWidth={2} />
              Re-generate
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting || !content}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                exporting || !content
                  ? 'cursor-not-allowed opacity-50 text-neutral-600 border border-white/[0.06]'
                  : 'text-[#C85B5B] border border-[rgba(200,91,91,0.25)] hover:bg-[rgba(200,91,91,0.08)]'
              )}
            >
              <Download size={12} strokeWidth={2} />
              Export
            </button>
          </>
        )}

        {mode === 'editing' && (
          <>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                saving ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'
              )}
              style={{
                backgroundColor: 'rgba(91, 200, 138, 0.1)',
                color: '#5BC88A',
                border: '1px solid rgba(91, 200, 138, 0.2)',
              }}
            >
              <Check size={12} strokeWidth={2} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200 border border-white/[0.08]"
            >
              <X size={12} strokeWidth={2} />
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Document display */}
      {mode === 'generating' && (
        <div
          className="relative rounded-xl border border-white/[0.08] bg-neutral-950/80 p-6"
          style={{ minHeight: '400px' }}
        >
          {/* Generating indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C85B5B] animate-pulse" />
            Generating
          </div>

          {streamedContent ? (
            <pre
              className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300"
              style={{ fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace' }}
            >
              {streamedContent}
              <span className="inline-block h-4 w-0.5 bg-[#C85B5B] ml-0.5 animate-pulse" />
            </pre>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-neutral-600">Preparing your document...</p>
            </div>
          )}
        </div>
      )}

      {mode === 'viewing' && (
        <div className="rounded-xl border border-white/[0.08] bg-neutral-950/80 p-6">
          {content ? (
            <pre
              className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300"
              style={{ fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace' }}
            >
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-neutral-600">No content yet. Click Re-generate to produce the document.</p>
            </div>
          )}
        </div>
      )}

      {mode === 'editing' && (
        <div className="rounded-xl border border-white/[0.08] bg-neutral-950/80 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-[11px] text-neutral-500">
              Edit the document text directly. Changes are saved when you click Save.
            </p>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full resize-none bg-transparent px-6 py-5 text-sm leading-relaxed text-neutral-300 outline-none"
            style={{
              fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace',
              minHeight: '500px',
            }}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}
