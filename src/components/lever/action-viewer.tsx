'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { Download, Pencil, RefreshCw, Check, X, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { leverActionTypeEnum } from '@/lib/db/schema'
import { hasLeverPdfTemplate } from '@/lib/pdf/types'
import { LetterPaper, type RecipientNoticeView } from '@/components/lever/letter-paper'
import {
  CHOOSE_PROVINCE_ERROR,
  PROVINCE_OPTIONS,
  isProvinceId,
  listedIn,
  provinceLabel,
  storedPublicBodyName,
  type ProvinceId,
} from '@/lib/lever/public-body'
import {
  INSERT_ADDRESS_LABEL,
  insertDirectoryAddress,
  resolveRecipientForViewer,
  screenRecipientNotice,
} from '@/lib/lever/recipient-notice'
import {
  conflictReason,
  EDIT_CONFLICT_MESSAGE,
  EDIT_NOT_A_DRAFT_MESSAGE,
  NEWER_VERSION_MESSAGE,
  NOT_A_DRAFT,
  STALE_VIEW_MESSAGE,
  STATUS_CHANGED,
  UNCLEAN_SPLIT,
  type WriteConflict,
} from '@/lib/lever/write-conflicts'

type LeverActionType = (typeof leverActionTypeEnum.enumValues)[number]
type Status = 'draft' | 'final' | 'filed'

interface ActionViewerProps {
  actionId: string
  initialContent: string
  initialStatus: Status
  actionType: LeverActionType
  /** `metadata.letterFormat`, passed to the letter parser untouched (absent means legacy). */
  letterFormat?: unknown
  /**
   * The action's recipient fields (`publicBody`, `publicBodyName`, `addressee`,
   * `jurisdiction`), for the §3 notices. FIPPA only.
   */
  recipientMetadata?: Record<string, unknown>
  /** The action's investigation's province, resolved on the server; null when there is none. */
  investigationProvince?: ProvinceId | null
}

type ViewMode = 'generating' | 'viewing' | 'editing'

const STATUS_FLOW: Record<string, Status> = {
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

const PDF_FAILED = "The PDF couldn't be made. Use Print or Plain text instead."
const RELOAD_FAILED = "The saved letter couldn't be reloaded. Reload the page to see it."

/**
 * SHA-256 of a string's UTF-8 bytes, lowercase hex: the same digest PATCH
 * computes in the database (`encode(sha256(convert_to(content,'UTF8')),'hex')`).
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** What a write was, for wording its 409. */
type WriteKind = 'edit' | 'status' | 'insert' | 'province'

/**
 * The message for a PATCH 409 (filings design §4). An edit's own text is
 * never discarded, and its messages say so; every other write says what
 * changed and how to see it.
 */
export function conflictMessage(reason: WriteConflict | null, kind: WriteKind, serverError: string | null): string {
  if (kind === 'edit') {
    if (reason === 'content-changed') return EDIT_CONFLICT_MESSAGE
    if (reason === 'not-a-draft') return EDIT_NOT_A_DRAFT_MESSAGE
  }
  // A status write the server refused for any reason this viewer doesn't
  // know (an invalid transition reached from a stale view) is a status that
  // changed elsewhere (Jen C2); developer text never reaches the citizen.
  if (kind === 'status' && reason === null) return STATUS_CHANGED
  switch (reason) {
    case 'content-changed':
      return STALE_VIEW_MESSAGE
    case 'not-a-draft':
      return `${NOT_A_DRAFT}. Reload to see it.`
    case 'status-changed':
      return STATUS_CHANGED
    case 'unclean-split':
      return UNCLEAN_SPLIT
    default:
      return serverError && !serverError.includes('→') ? serverError : 'That change could not be saved. Try again.'
  }
}

async function readError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

interface StoredAction {
  content: string | null
  status: Status
  metadata: Record<string, unknown> | null
}

export function ActionViewer({
  actionId,
  initialContent,
  initialStatus,
  actionType,
  letterFormat: initialLetterFormat,
  recipientMetadata,
  investigationProvince = null,
}: ActionViewerProps) {
  const [content, setContent] = useState(initialContent)
  const [editContent, setEditContent] = useState(initialContent)
  const [status, setStatus] = useState<Status>(initialStatus)
  // Generation records the letter format; the parser must see the new one.
  const [letterFormat, setLetterFormat] = useState<unknown>(initialLetterFormat)
  // A province chosen here (PATCH `jurisdiction`) overrides the stored one.
  const [jurisdiction, setJurisdictionState] = useState<unknown>(recipientMetadata?.jurisdiction)
  const setJurisdiction = useCallback((value: unknown) => {
    jurisdictionRef.current = value
    setJurisdictionState(value)
  }, [])
  const [mode, setMode] = useState<ViewMode>(initialContent ? 'viewing' : 'generating')
  const [streamedContent, setStreamedContent] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inserting, setInserting] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsProvince, setNeedsProvince] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  /*
   * The directory body this action names, if it names a listed one, and its
   * province. A listed body belongs to one province, so the province choice
   * offers only that one (Razor N5: any other pick leaves generation refused
   * with no way back from the screen).
   */
  const bodyListing = useMemo(() => {
    const name = storedPublicBodyName(recipientMetadata ?? {})
    return name ? listedIn(name) : null
  }, [recipientMetadata])
  const jurisdictionRef = useRef<unknown>(recipientMetadata?.jurisdiction)
  const bodyListingMismatch = () =>
    !!bodyListing && isProvinceId(jurisdictionRef.current) && jurisdictionRef.current !== bodyListing.province

  /*
   * The compare-and-set baseline (§4): the hash of the content exactly as the
   * server returned it, taken before it reaches the textarea (which turns
   * CRLF into LF). Re-taken from the stored text after every successful
   * write and every re-read, so saving twice is never a false conflict.
   */
  const baselineRef = useRef<Promise<string> | null>(null)
  const baseline = useCallback((): Promise<string> => {
    baselineRef.current ??= sha256Hex(initialContent)
    return baselineRef.current
  }, [initialContent])
  const rebaseline = useCallback((stored: string) => {
    baselineRef.current = sha256Hex(stored)
  }, [])

  /** The stored row, re-read: after a stream ends, the server's text is the truth. */
  const readStored = useCallback(async (): Promise<StoredAction | null> => {
    try {
      const res = await fetch(`/api/lever/actions/${actionId}`, { cache: 'no-store' })
      if (!res.ok) return null
      const body = (await res.json()) as { action?: StoredAction }
      return body.action ?? null
    } catch {
      return null
    }
  }, [actionId])

  /** Adopt a stored row as what the viewer shows and writes against. */
  const adoptStored = useCallback(
    (stored: StoredAction) => {
      const text = stored.content ?? ''
      setContent(text)
      setEditContent(text)
      setStatus(stored.status)
      setLetterFormat(stored.metadata?.letterFormat)
      setJurisdiction(stored.metadata?.jurisdiction)
      rebaseline(text)
    },
    [rebaseline, setJurisdiction]
  )

  /**
   * One PATCH with the baseline hash, every time (Razor N4, A2: a second tab
   * could otherwise finalise text this one never displayed). Returns the
   * stored content on success, or the 409's reason and server text.
   */
  const patch = useCallback(
    async (
      fields: Record<string, unknown>
    ): Promise<
      | { ok: true; content: string | null }
      | { ok: false; status: number; reason: WriteConflict | null; error: string | null }
    > => {
      const expectedContentSha256 = await baseline()
      const res = await fetch(`/api/lever/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, expectedContentSha256 }),
      })
      if (res.ok) {
        const body = (await res.json()) as { action?: { content?: string | null } }
        return { ok: true, content: body.action?.content ?? null }
      }
      const error = await readError(res)
      return { ok: false, status: res.status, reason: res.status === 409 ? conflictReason(error) : null, error }
    },
    [actionId, baseline]
  )

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
    setInfo(null)

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
        const error = res.ok ? null : await readError(res)
        // A FIPPA draft with no province gets the choice, here (A2 carry).
        if (res.status === 409 && error === CHOOSE_PROVINCE_ERROR) {
          setNeedsProvince(true)
          setMode('viewing')
          return
        }
        // A draft whose stored province doesn't match its listed body (Razor
        // N5): the server's message, and the choice again, limited to the
        // body's own province, so the draft is never stranded.
        if (res.status === 409 && bodyListing && bodyListingMismatch()) {
          setActionError(error ?? 'Generation failed. Try again.')
          setNeedsProvince(true)
          setMode('viewing')
          return
        }
        setActionError(error ?? 'Generation failed. Try again.')
        setMode('viewing')
        return
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

      // The stream closes only after the server's compare-and-set has run, so
      // this read sees what was stored. If another write won, that is shown,
      // and said.
      const stored = await readStored()
      if (stored) {
        adoptStored(stored)
        if ((stored.content ?? '') !== accumulated) setInfo(NEWER_VERSION_MESSAGE)
      } else {
        setContent(accumulated)
        setEditContent(accumulated)
        // No re-read, so no baseline from the server: the streamed text is
        // the best guess, and a wrong guess is a 409, never a lost write.
        rebaseline(accumulated)
        setActionError(RELOAD_FAILED)
      }
      setMode('viewing')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[action-viewer] Generate failed:', err)
        setActionError('Generation failed. Try again.')
        setMode('viewing')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, readStored, adoptStored, rebaseline])

  /*
   * Finalising a marker-v1 letter whose notes aren't cleanly separated is
   * refused by the server (§4). This is the one place that refusal is
   * handled: it shows the message and leaves the letter as it is. Lee has not
   * yet ruled whether a letter whose marker line was deleted may be
   * finalised after a confirmation (Razor W1, A2); if he says yes, the
   * confirm step goes here and nowhere else.
   */
  const onUncleanSplitRefused = useCallback(() => {
    setActionError(conflictMessage('unclean-split', 'status', null))
  }, [])

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
    setActionError(null)
    setInfo(null)
    try {
      const result = await patch({ status: next })
      if (result.ok) {
        setStatus(next)
        if (result.content !== null) rebaseline(result.content)
      } else if (result.reason === 'unclean-split') {
        onUncleanSplitRefused()
      } else {
        // Only a 409 is a conflict; any other refusal shows its own message
        // (never developer text with an arrow).
        setActionError(
          result.status === 409
            ? conflictMessage(result.reason, 'status', result.error)
            : result.error && !result.error.includes('→')
              ? result.error
              : 'Failed to update status. Try again.'
        )
      }
    } catch (err) {
      console.error('[action-viewer] Status update failed:', err)
      setActionError('Failed to update status. Try again.')
    } finally {
      setStatusUpdating(false)
    }
  }, [status, patch, rebaseline, onUncleanSplitRefused])

  const handleSaveEdit = useCallback(async () => {
    setSaving(true)
    setActionError(null)
    setInfo(null)
    try {
      const result = await patch({ content: editContent })
      if (result.ok) {
        const stored = result.content ?? editContent
        setContent(stored)
        setEditContent(stored)
        rebaseline(stored)
        setMode('viewing')
      } else {
        // The citizen's text stays in the textarea, whatever went wrong.
        setActionError(conflictMessage(result.reason, 'edit', result.error))
      }
    } catch (err) {
      console.error('[action-viewer] Save failed:', err)
      setActionError('Failed to save changes. Try again.')
    } finally {
      setSaving(false)
    }
  }, [editContent, patch, rebaseline])

  const handleCancelEdit = useCallback(() => {
    setEditContent(content)
    setActionError(null)
    setMode('viewing')
  }, [content])

  /** "Insert directory address": an explicit edit, through the same compare-and-set as Save. */
  const handleInsertAddress = useCallback(
    async (address: string) => {
      const next = insertDirectoryAddress(content, letterFormat, address)
      if (next === null) return
      setInserting(true)
      setActionError(null)
      setInfo(null)
      try {
        const result = await patch({ content: next })
        if (result.ok) {
          const stored = result.content ?? next
          setContent(stored)
          setEditContent(stored)
          rebaseline(stored)
        } else {
          setActionError(conflictMessage(result.reason, 'insert', result.error))
        }
      } catch (err) {
        console.error('[action-viewer] Insert address failed:', err)
        setActionError("The address couldn't be inserted. Try again.")
      } finally {
        setInserting(false)
      }
    },
    [content, letterFormat, patch, rebaseline]
  )

  /** The province choice, after a generate refused for want of one. Stored, then the letter is generated. */
  const handleChooseProvince = useCallback(
    async (province: ProvinceId) => {
      setActionError(null)
      try {
        const result = await patch({ jurisdiction: province })
        if (!result.ok) {
          setActionError(conflictMessage(result.reason, 'province', result.error))
          return
        }
        setJurisdiction(province)
        setNeedsProvince(false)
        setActionError(null)
        await runGenerate()
      } catch (err) {
        console.error('[action-viewer] Province update failed:', err)
        setActionError("The province couldn't be saved. Try again.")
      }
    },
    [patch, runGenerate, setJurisdiction]
  )

  /*
   * One handler for every download in the Export menu. TXT and MD are the
   * stored text exactly as written; PDF is the rendered letter. A failure is
   * shown, never swallowed, and never downloaded as a file.
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
      if (!res.ok) {
        const error = await readError(res)
        // A PDF that ran out of time is a 503 that says what to use instead.
        if (format === 'pdf' && res.status === 503 && error) {
          setActionError(error)
          return
        }
        throw new Error(`Export failed (${res.status})`)
      }

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
      setActionError(format === 'pdf' ? PDF_FAILED : 'Export failed. Try again.')
    } finally {
      setExporting(null)
    }
  }, [actionId])

  const handlePrint = useCallback(() => {
    setActionError(null)
    window.open(`/api/lever/actions/${actionId}/print`, '_blank')
  }, [actionId])

  const isFippa = actionType === 'fippa_request'

  // The §3 notice, re-worded as the letter changes (an insert, an edit, a generation).
  const recipientNotice = useMemo<RecipientNoticeView | null>(() => {
    if (!isFippa || !content) return null
    const resolution = resolveRecipientForViewer({ ...(recipientMetadata ?? {}), jurisdiction }, investigationProvince)
    const notice = screenRecipientNotice(resolution, content, letterFormat, status)
    const address = notice.insertAddress
    return {
      lines: notice.lines,
      insert: address
        ? { label: INSERT_ADDRESS_LABEL, onInsert: () => void handleInsertAddress(address), busy: inserting }
        : null,
    }
  }, [isFippa, content, recipientMetadata, jurisdiction, investigationProvince, letterFormat, status, inserting, handleInsertAddress])

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
                onClick={() => { setEditContent(content); setActionError(null); setMode('editing') }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary border border-border hover:border-border-strong"
              >
                <Pencil size={12} strokeWidth={2} />
                Edit
              </button>
            )}

            {/* Re-generate — drafts only: the server refuses final and filed (A2) */}
            {status === 'draft' && (
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

      {/* What happened, when it isn't an error (a newer version was kept) */}
      {info && (
        <p role="status" className="text-xs text-text-secondary">{info}</p>
      )}

      {needsProvince && mode === 'viewing' && (
        <ProvinceChoice
          onChoose={handleChooseProvince}
          only={bodyListing ? { province: bodyListing.province, body: bodyListing.name } : null}
        />
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

      {mode === 'viewing' && isFippa && content && (
        <LetterPaper content={content} letterFormat={letterFormat} status={status} recipient={recipientNotice} />
      )}

      {mode === 'viewing' && !(isFippa && content) && (
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
// Province choice (a FIPPA draft whose generation needs one)
// ---------------------------------------------------------------------------

function ProvinceChoice({
  onChoose,
  only,
}: {
  onChoose: (province: ProvinceId) => Promise<void>
  /** A listed body's own province: the only one offered, pre-selected. */
  only: { province: ProvinceId; body: string } | null
}) {
  const selectId = useId()
  const [choice, setChoice] = useState<ProvinceId | ''>(only ? only.province : '')
  const options = only ? PROVINCE_OPTIONS.filter((p) => p.id === only.province) : PROVINCE_OPTIONS
  const [busy, setBusy] = useState(false)
  return (
    // A <div> and a click handler, not a <form>: the app's pattern since the
    // React 19 form re-invocation bug (auth triple-fire).
    <div
      data-province-choice
      className="rounded-lg border border-border bg-surface-1 px-4 py-3"
      style={{ borderLeft: '3px solid var(--status-warning)' }}
    >
      <label htmlFor={selectId} className="mb-1.5 block text-sm text-text-secondary">
        {CHOOSE_PROVINCE_ERROR}.
      </label>
      {only && (
        <p data-province-reason className="mb-2 text-sm text-text-secondary">
          {only.body} is in the {provinceLabel(only.province)} directory, so this request goes to{' '}
          {provinceLabel(only.province)}. For another province, start a new request.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            id={selectId}
            value={choice}
            required
            onChange={(e) => setChoice(isProvinceId(e.target.value) ? e.target.value : '')}
            className="appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0"
          >
            <option value="" disabled>
              Choose a province...
            </option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.verified ? p.label : `${p.label} (not verified)`}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>
        <button
          type="button"
          onClick={async () => {
            if (!choice || busy) return
            setBusy(true)
            try {
              await onChoose(choice)
            } finally {
              setBusy(false)
            }
          }}
          disabled={!choice || busy}
          className="inline-flex items-center rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Use this province and generate'}
        </button>
      </div>
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
