'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Pencil, RefreshCw, Check, X, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { leverActionTypeEnum } from '@/lib/db/schema'
import { hasLeverPdfTemplate } from '@/lib/pdf/types'
import { LetterPaper } from '@/components/lever/letter-paper'

type LeverActionType = (typeof leverActionTypeEnum.enumValues)[number]

interface ActionViewerProps {
  actionId: string
  initialContent: string
  initialStatus: 'draft' | 'final' | 'filed'
  actionType: LeverActionType
  /** `metadata.letterFormat`, passed to the letter parser untouched (absent means legacy). */
  letterFormat?: unknown
}

type ViewMode = 'generating' | 'viewing' | 'editing'

const STATUS_FLOW: Record<string, 'draft' | 'final' | 'filed'> = {
  draft: 'final',
  final: 'filed',
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: 'Draft', color: 'var(--accent-gadfly)', bg: 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)', border: 'color-mix(in srgb, var(--accent-gadfly) 25%, transparent)' },
  final: { label: 'Final', color: 'var(--accent-mirror)', bg: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)', border: 'color-mix(in srgb, var(--accent-mirror) 25%, transparent)' },
  filed: { label: 'Filed', color: 'var(--accent-oracle)', bg: 'color-mix(in srgb, var(--accent-oracle) 10%, transparent)', border: 'color-mix(in srgb, var(--accent-oracle) 25%, transparent)' },
}

const ADVANCE_LABELS: Record<string, string> = {
  draft: 'Mark as Final',
  final: 'Mark as Filed',
}

type ExportFormat = 'txt' | 'md' | 'pdf'

const EXPORT_FALLBACK_NAMES: Record<ExportFormat, string> = {
  txt: 'action.txt',
  md: 'action.md',
  pdf: 'action.pdf',
}

export function ActionViewer({ actionId, initialContent, initialStatus, actionType, letterFormat }: ActionViewerProps) {
  const [content, setContent] = useState(initialContent)
  const [editContent, setEditContent] = useState(initialContent)
  const [status, setStatus] = useState<'draft' | 'final' | 'filed'>(initialStatus)
  const [mode, setMode] = useState<ViewMode>(initialContent ? 'viewing' : 'generating')
  const [streamedContent, setStreamedContent] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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
    setActionError(null)

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
        setActionError('Generation failed. Try again.')
        setMode('viewing')
      }
    }
  }, [actionId])

  const handleAdvanceStatus = useCallback(async () => {
    const next = STATUS_FLOW[status]
    if (!next) return

    // Confirmation gate when filing
    if (next === 'filed') {
      const confirmed = window.confirm(
        'This will record this action as officially filed. Continue?'
      )
      if (!confirmed) return
    }

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
      setActionError('Failed to update status. Try again.')
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
      setActionError('Failed to save changes. Try again.')
    } finally {
      setSaving(false)
    }
  }, [actionId, editContent])

  const handleCancelEdit = useCallback(() => {
    setEditContent(content)
    setMode('viewing')
  }, [content])

  /*
   * One handler for every download in the Export menu. TXT and MD are the
   * stored text exactly as written; PDF is the rendered letter. A failure is
   * shown, never swallowed.
   */
  const handleExport = useCallback(async (format: ExportFormat) => {
    setExporting(format)
    setActionError(null)
    try {
      const res = await fetch('/api/lever/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, format }),
      })
      if (!res.ok) throw new Error(`Export failed (${res.status})`)

      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition') ?? ''
      const match = contentDisposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : EXPORT_FALLBACK_NAMES[format]

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(`[action-viewer] ${format} export failed:`, err)
      setActionError(format === 'pdf' ? "The PDF couldn't be made. Use Print or Plain text instead." : 'Export failed. Try again.')
    } finally {
      setExporting(null)
    }
  }, [actionId])

  const handlePrint = useCallback(() => {
    window.open(`/api/lever/actions/${actionId}/print`, '_blank')
  }, [actionId])

  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  const nextStatus = STATUS_FLOW[status]

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-start gap-2 sm:items-center">
        {/* Status badge */}
        <span
          className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium"
          style={{ color: statusStyle.color, backgroundColor: statusStyle.bg, border: `1px solid ${statusStyle.border}` }}
        >
          {statusStyle.label}
        </span>

        {/* The actions wrap onto their own lines on a phone, right-aligned. */}
        <div className="flex flex-1 flex-wrap justify-end gap-2">
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
                  backgroundColor: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)',
                  color: 'var(--accent-mirror)',
                  border: '1px solid color-mix(in srgb, var(--accent-mirror) 20%, transparent)',
                }}
              >
                <Check size={12} strokeWidth={2} />
                {ADVANCE_LABELS[status]}
              </button>
            )}

            {/* Edit — only available in draft */}
            {status === 'draft' && (
              <button
                onClick={() => { setEditContent(content); setMode('editing') }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary border border-border hover:border-border-strong"
              >
                <Pencil size={12} strokeWidth={2} />
                Edit
              </button>
            )}

            {/* Re-generate — not available once filed */}
            {status !== 'filed' && (
              <button
                onClick={runGenerate}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary border border-border hover:border-border-strong"
              >
                <RefreshCw size={12} strokeWidth={2} />
                Re-generate
              </button>
            )}

            {/* Export: one menu for every way out (RS-P2-10) */}
            <ExportMenu
              disabled={!content}
              busy={exporting}
              pdf={hasLeverPdfTemplate(actionType)}
              onExport={handleExport}
              onPrint={handlePrint}
            />
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
                backgroundColor: 'color-mix(in srgb, var(--accent-mirror) 10%, transparent)',
                color: 'var(--accent-mirror)',
                border: '1px solid color-mix(in srgb, var(--accent-mirror) 20%, transparent)',
              }}
            >
              <Check size={12} strokeWidth={2} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary border border-border"
            >
              <X size={12} strokeWidth={2} />
              Cancel
            </button>
          </>
        )}
        </div>
      </div>

      {/* Error alert */}
      {actionError && (
        <p role="alert" className="text-xs text-status-danger">{actionError}</p>
      )}

      {/* Document display */}
      {mode === 'generating' && (
        <div
          className="relative rounded-xl border border-border bg-surface-1 shadow-sm p-6"
          style={{ minHeight: '400px' }}
        >
          {/* Generating indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-2xs font-medium text-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-lever)] animate-pulse" />
            Generating
          </div>

          {streamedContent ? (
            <pre
              className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary"
              style={{ fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace' }}
            >
              {streamedContent}
              <span className="inline-block h-4 w-0.5 bg-[var(--accent-lever)] ml-0.5 animate-pulse" />
            </pre>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-text-faint">Preparing your document...</p>
            </div>
          )}
        </div>
      )}

      {mode === 'viewing' && actionType === 'fippa_request' && content && (
        <LetterPaper content={content} letterFormat={letterFormat} status={status} />
      )}

      {mode === 'viewing' && !(actionType === 'fippa_request' && content) && (
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm p-6">
          {content ? (
            <pre
              className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary"
              style={{ fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace' }}
            >
              {content}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm text-text-faint">No content yet. Click Re-generate to produce the document.</p>
            </div>
          )}
        </div>
      )}

      {mode === 'editing' && (
        <div className="rounded-xl border border-border bg-surface-1 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-surface-1">
            <p className="text-2xs font-medium text-text-muted">
              Edit the document text directly. Changes are saved when you click Save.
            </p>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            aria-label="Edit document text"
            className="w-full resize-none bg-transparent px-6 py-5 text-sm leading-relaxed text-text-secondary outline-none"
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

// ---------------------------------------------------------------------------
// Export menu
// ---------------------------------------------------------------------------

const MENU_TRIGGER_ON =
  'text-[var(--accent-lever)] border border-[color-mix(in_srgb,var(--accent-lever)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent-lever)_8%,transparent)]'
const MENU_TRIGGER_OFF = 'cursor-not-allowed opacity-50 text-text-faint border border-border'

interface ExportMenuProps {
  disabled: boolean
  busy: ExportFormat | null
  pdf: boolean
  onExport: (format: ExportFormat) => void
  onPrint: () => void
}

/**
 * A disclosure menu: Escape and a click outside close it, arrow keys move
 * between items, and focus returns to the trigger on close.
 */
function ExportMenu({ disabled, busy, pdf, onExport, onPrint }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // The rendered letter first, then the stored text as written (Jen).
  const rendered: { key: string; label: string; run: () => void }[] = [
    ...(pdf ? [{ key: 'pdf', label: 'PDF', run: () => onExport('pdf') }] : []),
    { key: 'print', label: 'Print', run: onPrint },
  ]
  const asWritten: { key: string; label: string; run: () => void }[] = [
    { key: 'txt', label: 'Plain text (as written)', run: () => onExport('txt') },
    { key: 'md', label: 'Markdown (as written)', run: () => onExport('md') },
  ]

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, close])

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const at = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(at + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(at - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      els[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      els[els.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  // While an export runs the trigger stays focusable and at full ink
  // (aria-busy + aria-disabled, clicks ignored), so focus is never dropped.
  const isBusy = busy !== null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isBusy) setOpen((o) => !o)
        }}
        disabled={disabled}
        aria-busy={isBusy || undefined}
        aria-disabled={isBusy || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="lever-export-menu"
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
          disabled ? MENU_TRIGGER_OFF : MENU_TRIGGER_ON,
          isBusy && 'cursor-progress'
        )}
      >
        <Download size={12} strokeWidth={2} />
        {busy === 'pdf' ? 'Making the PDF...' : busy ? 'Preparing...' : 'Export'}
        <ChevronDown size={12} strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div
          ref={menuRef}
          id="lever-export-menu"
          role="menu"
          aria-label="Export"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 mt-1.5 min-w-[13rem] rounded-xl border border-border bg-surface-1 p-1 shadow-lg"
        >
          {rendered.map((item) => (
            <MenuItem key={item.key} label={item.label} onSelect={() => { close(true); item.run() }} />
          ))}
          <div role="separator" className="my-1 border-t border-border" />
          {asWritten.map((item) => (
            <MenuItem key={item.key} label={item.label} onSelect={() => { close(true); item.run() }} />
          ))}
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:bg-surface-2 focus-visible:text-text-primary"
    >
      {label}
    </button>
  )
}
