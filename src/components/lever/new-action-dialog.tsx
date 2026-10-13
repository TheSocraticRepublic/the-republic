'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, ChevronDown, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { leverActionTypeEnum } from '@/lib/db/schema'
import {
  PROVINCE_OPTIONS,
  PUBLIC_BODY_DIRECTORY,
  isProvinceId,
  provinceLabel,
  resolveInvestigationProvince,
  type ProvinceId,
} from '@/lib/lever/public-body'

interface Document {
  id: string
  title: string
  status: string
}

interface Session {
  id: string
  title: string
}

interface ExistingAction {
  id: string
  actionType: string
  investigationId?: string | null
}

// Derived from the schema enum so TypeScript stays in sync when new types are added.
// Note: media_spec, talking_points, and coalition_template are Campaign-layer actions
// and are intentionally excluded from this dialog's UI options.
type ActionType = (typeof leverActionTypeEnum.enumValues)[number]

const ACTION_TYPES: { value: ActionType; label: string; description: string }[] = [
  { value: 'fippa_request', label: 'FIPPA Request', description: 'Freedom-of-information request' },
  { value: 'public_comment', label: 'Public Comment', description: 'Council or agency' },
  { value: 'policy_brief', label: 'Policy Brief', description: 'Evidence-based proposal' },
]

const DESCRIPTION_PLACEHOLDERS: Partial<Record<ActionType, string>> = {
  fippa_request: 'What records do you want to request?',
  public_comment: "What is your concern or position on the proposed bylaw, permit, or policy?",
  policy_brief: 'What policy problem are you addressing and what change do you recommend?',
}

/** The public-body select's value for "Other (type the name)". Not a body name. */
const OTHER_BODY = '__other__'

interface NewActionDialogProps {
  initialDocumentId?: string
  initialSessionId?: string
  initialInvestigationId?: string
  initialActionType?: string
  /** Open on arrival: the landing's empty state links to `/lever?new=1`
   *  (app-arms P1-5), the same way a pre-filled cross-arm link opens it. */
  initialOpen?: boolean
}

/**
 * `?new=1` (the landing's empty-state link) asks for this dialog open. Take the
 * flag off the current entry with `replace`, keeping every other param: the
 * empty-state link itself replaces, so closing leaves one entry, not two
 * (Razor C2a N2), and a create never leaves the flag in history behind the new
 * page, where Back would reopen an empty dialog (Razor C2a W2).
 */
function withoutNewFlag(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('new')
  return url.pathname + url.search
}

export function NewActionDialog({
  initialDocumentId,
  initialSessionId,
  initialInvestigationId,
  initialActionType,
  initialOpen,
}: NewActionDialogProps = {}) {
  const oracleDocId = useId()
  const gadflyInquiryId = useId()
  const provinceSelectId = useId()
  const otherBodyId = useId()
  const bodyErrorId = useId()
  const generateReasonId = useId()
  const provinceSelectRef = useRef<HTMLSelectElement>(null)
  const bodySelectRef = useRef<HTMLSelectElement>(null)
  const otherBodyRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const createErrorRef = useRef<HTMLParagraphElement>(null)

  // The address is the truth for ?new=1, not the page's prop: Back restores
  // a cached render whose prop still says open, while the entry it lands on
  // no longer carries the flag (measured on the harness after a create).
  const urlFlag = useSearchParams().get('new') === '1'
  const flagged = !!initialOpen && urlFlag
  const [open, setOpen] = useState(!!(flagged || initialDocumentId || initialSessionId || initialInvestigationId))
  const [actionType, setActionType] = useState<ActionType>(
    (initialActionType as ActionType) || 'fippa_request'
  )
  // The body select holds an exact directory name, OTHER_BODY, or ''.
  const [publicBodyChoice, setPublicBodyChoice] = useState('')
  const [otherBodyName, setOtherBodyName] = useState('')
  // The province the request goes to. Pre-selected from the investigation's
  // detected jurisdiction when there is one, and always confirmable: the
  // detection is a keyword guess.
  const [province, setProvince] = useState<ProvinceId | ''>('')
  const [provinceDetected, setProvinceDetected] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId ?? '')
  const [investigationId] = useState(initialInvestigationId ?? '')
  const [description, setDescription] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  // Synchronous guard: a second click before the first request's state
  // update renders is ignored, not sent.
  const creatingRef = useRef(false)
  // Once the citizen picks a province, a late detection never overrides it.
  const provinceTouchedRef = useRef(false)
  const [fetchingContext, setFetchingContext] = useState(false)
  const [dupWarning, setDupWarning] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // A refusal the server tied to the public-body field, shown under it.
  const [bodyError, setBodyError] = useState<string | null>(null)
  const router = useRouter()
  // Open on the flag's rising edge, adjusting state during render (not an
  // effect, and not a key: a remount would detach the trigger that Radix
  // hands focus back to on close, dropping focus to <body>; Razor C2a W1).
  const [flagSeen, setFlagSeen] = useState(flagged)
  if (flagged !== flagSeen) {
    setFlagSeen(flagged)
    if (flagged) setOpen(true)
  }
  const clearNewFlag = useCallback(() => {
    router.replace(withoutNewFlag(), { scroll: false })
  }, [router])

  // Fetch documents, sessions, and the investigation (for the province) when the dialog opens
  useEffect(() => {
    if (!open) return
    setFetchingContext(true)

    type ContextResponse = {
      documents?: Document[]
      sessions?: Session[]
      investigation?: { jurisdictionName?: string | null; concern?: string | null; jurisdictionProvince?: string | null }
      actions?: ExistingAction[]
    } | null

    const promises: Promise<ContextResponse>[] = [
      fetch('/api/oracle/documents').then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch('/api/gadfly/session').then((r) => r.json()).catch(() => ({ sessions: [] })),
    ]

    // If opened from investigation context, fetch investigation to detect jurisdiction
    if (investigationId) {
      promises.push(
        fetch(`/api/investigate/${investigationId}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      )
      // Check for existing FIPPA requests on this investigation
      promises.push(
        fetch('/api/lever/actions')
          .then((r) => r.ok ? r.json() : { actions: [] })
          .catch(() => ({ actions: [] }))
      )
    }

    Promise.all(promises).then(async ([docsData, sessionsData, investigationData, actionsData]) => {
      const ready = (docsData?.documents ?? []).filter((d: Document) => d.status === 'ready')
      setDocuments(ready)
      setSessions(sessionsData?.sessions ?? [])

      // Pre-select the province from the investigation, by the same rule the
      // server resolves it with: its resolved jurisdiction's province first,
      // keyword detection second. The citizen confirms it; with neither they
      // must choose one.
      const inv = investigationData?.investigation
      const detected = inv
        ? resolveInvestigationProvince({
            concern: inv.concern ?? '',
            jurisdictionName: inv.jurisdictionName ?? null,
            province: inv.jurisdictionProvince ?? null,
          })
        : null
      if (detected && !provinceTouchedRef.current) {
        setProvince(detected)
        setProvinceDetected(true)
      }

      // Check for duplicate FIPPA on this investigation
      if (actionsData?.actions && investigationId) {
        const existing = (actionsData.actions as ExistingAction[]).filter(
          (a) => a.actionType === 'fippa_request' && a.investigationId === investigationId
        )
        // We can only check actions that have investigationId set - for now,
        // show warning if any fippa_request exists and we came from an investigation
        if (existing.length > 0) {
          setDupWarning(true)
        }
      }
    }).finally(() => setFetchingContext(false))
  }, [open, investigationId])

  const isFippa = actionType === 'fippa_request'
  const publicBodies = province ? PUBLIC_BODY_DIRECTORY[province] : []
  const publicBodyName =
    publicBodyChoice === OTHER_BODY ? otherBodyName.trim() : publicBodyChoice
  const canCreate = !!description.trim() && (!isFippa || !!province)
  const provinceUnverified = !!province && PROVINCE_OPTIONS.find((p) => p.id === province)?.verified === false
  const showGenerateReason = isFippa && !province && !!description.trim()

  // An error takes focus when it appears: the field-level one focuses the
  // field it is about, the footer one focuses itself.
  useEffect(() => {
    if (!bodyError) return
    if (publicBodyChoice === OTHER_BODY) otherBodyRef.current?.focus()
    else bodySelectRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyError])
  useEffect(() => {
    if (createError) createErrorRef.current?.focus()
  }, [createError])

  const clearErrors = () => {
    setBodyError(null)
    setCreateError(null)
  }

  const handleCreate = useCallback(async () => {
    // Generate is aria-disabled, not disabled, while it can't run: it stays
    // in the tab order, and activating it takes the citizen to what's missing.
    if (!description.trim()) {
      descriptionRef.current?.focus()
      return
    }
    if (actionType === 'fippa_request' && !province) {
      const select = provinceSelectRef.current
      if (select) {
        const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        select.scrollIntoView?.({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
        select.focus()
      }
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    setLoading(true)
    setCreateError(null)
    setBodyError(null)
    try {
      const res = await fetch('/api/lever/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          publicBodyName: actionType === 'fippa_request' && publicBodyName ? publicBodyName : undefined,
          jurisdiction: actionType === 'fippa_request' ? province : undefined,
          documentId: selectedDocId || undefined,
          sessionId: selectedSessionId || undefined,
          investigationId: investigationId || undefined,
          description: description.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        // A 4xx carries the server's own plain-instructional reason; show it.
        // Network failures and 5xx keep the generic line below.
        if (res.status >= 400 && res.status < 500 && typeof data?.error === 'string') {
          if (data.field === 'publicBody') setBodyError(data.error)
          else setCreateError(data.error)
          return
        }
        throw new Error(`Create failed (${res.status})`)
      }
      setOpen(false)
      // Synchronously, not through router.replace: a router.replace followed
      // at once by router.push is superseded by the push, which left the
      // flag in history behind the new page (measured on the harness).
      // The router is not told of this native replaceState here; it learns
      // the stripped address when the push below reads the current URL.
      // Passing history.state through keeps the router's entry intact.
      if (flagged) window.history.replaceState(window.history.state, '', withoutNewFlag())
      router.push(`/lever/${data.actionId}`)
    } catch (err) {
      console.error(err)
      setCreateError('Failed to create action. Try again.')
    } finally {
      creatingRef.current = false
      setLoading(false)
    }
  }, [actionType, publicBodyName, province, selectedDocId, selectedSessionId, investigationId, description, router, flagged])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    // Opened by ?new=1: take the flag off the address on close, so a reload
    // doesn't reopen it and the empty state's link opens it again next time.
    if (!v && flagged) clearNewFlag()
    if (!v) {
      setActionType((initialActionType as ActionType) || 'fippa_request')
      setPublicBodyChoice('')
      setOtherBodyName('')
      setBodyError(null)
      setProvince('')
      setProvinceDetected(false)
      provinceTouchedRef.current = false
      setSelectedDocId('')
      setSelectedSessionId('')
      setDescription('')
      setDupWarning(false)
      setCreateError(null)
    }
  }, [initialActionType, flagged, clearNewFlag])

  // When pre-filled from cross-arm nav, trigger document/session fetch on mount
  // The existing useEffect already handles this when open=true

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-lever) 15%, transparent)',
            color: 'var(--accent-lever)',
            border: '1px solid color-mix(in srgb, var(--accent-lever) 25%, transparent)',
          }}
        >
          <Plus size={14} strokeWidth={2} />
          New Action
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-text-primary"
            >
              New Civic Action
            </Dialog.Title>
            <Dialog.Close aria-label="Close dialog" className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary">
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Action type selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Document type
              </label>
              <div role="group" aria-label="Action type" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActionType(t.value)}
                    aria-pressed={actionType === t.value}
                    className={clsx(
                      'rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 text-left',
                      actionType === t.value
                        ? 'border-[var(--accent-lever)]/40 bg-[var(--accent-lever)]/10 text-[var(--accent-lever)]'
                        : 'border-border bg-surface-1 text-text-muted hover:border-border-strong hover:text-text-secondary'
                    )}
                  >
                    <span className="block font-semibold">{t.label}</span>
                    <span className="mt-0.5 block text-2xs font-medium opacity-70">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Province — FIPPA only, always shown, required */}
            {isFippa && (
              <div>
                <label htmlFor={provinceSelectId} className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Province
                </label>
                <div className="relative">
                  <select
                    ref={provinceSelectRef}
                    id={provinceSelectId}
                    value={province}
                    required
                    aria-describedby={`${provinceSelectId}-hint`}
                    onChange={(e) => {
                      const next = e.target.value
                      provinceTouchedRef.current = true
                      setProvince(isProvinceId(next) ? next : '')
                      setProvinceDetected(false)
                      // Bodies belong to one province; a new province clears the choice.
                      setPublicBodyChoice('')
                      // ...including a typed "Other" name.
                      setOtherBodyName('')
                      clearErrors()
                    }}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0"
                  >
                    <option value="" disabled>
                      Choose a province...
                    </option>
                    {PROVINCE_OPTIONS.map((p) => (
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
                <p id={`${provinceSelectId}-hint`} className="mt-1.5 text-2xs text-text-muted">
                  {!province && 'Choose the province this request goes to.'}
                  {provinceUnverified && (
                    <span className="block text-xs text-text-secondary">
                      Open Cave has not verified {provinceLabel(province as ProvinceId)}&apos;s legal citations yet. Check
                      each one against the Act before you file.
                    </span>
                  )}
                  {province && provinceDetected && (
                    <span className={clsx('block', provinceUnverified && 'mt-0.5')}>
                      Detected from your investigation. Change it if it is wrong.
                    </span>
                  )}
                  {province && !provinceDetected && !provinceUnverified && "The request cites this province's access law."}
                </p>
              </div>
            )}

            {/* Public body selector — FIPPA only, from the chosen province */}
            {isFippa && (
              <div>
                <label htmlFor="action-public-body" className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Public body <span className="text-text-faint">(optional)</span>
                </label>
                <div className="relative">
                  <select
                    ref={bodySelectRef}
                    id="action-public-body"
                    value={publicBodyChoice}
                    disabled={!province}
                    aria-invalid={bodyError && publicBodyChoice !== OTHER_BODY ? true : undefined}
                    aria-describedby={bodyError && publicBodyChoice !== OTHER_BODY ? bodyErrorId : undefined}
                    onChange={(e) => {
                      setPublicBodyChoice(e.target.value)
                      clearErrors()
                    }}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">{province ? 'Select a public body...' : 'Choose a province first'}</option>
                    {publicBodies.map((pb) => (
                      <option key={`${pb.jurisdiction}-${pb.name}`} value={pb.name}>
                        {pb.name}
                      </option>
                    ))}
                    {province && <option value={OTHER_BODY}>Other (type the name)</option>}
                  </select>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                </div>
                {publicBodyChoice === OTHER_BODY && (
                  <div className="mt-2">
                    <label htmlFor={otherBodyId} className="sr-only">
                      Public body name
                    </label>
                    <input
                      ref={otherBodyRef}
                      id={otherBodyId}
                      type="text"
                      value={otherBodyName}
                      maxLength={200}
                      aria-invalid={bodyError ? true : undefined}
                      aria-describedby={bodyError ? bodyErrorId : undefined}
                      onChange={(e) => {
                        setOtherBodyName(e.target.value)
                        clearErrors()
                      }}
                      placeholder="Name of the public body"
                      className="w-full rounded-lg border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:border-[var(--accent-lever)]/40"
                    />
                  </div>
                )}
                {bodyError && (
                  <p id={bodyErrorId} className="mt-1.5 text-xs text-status-danger">
                    {bodyError}
                  </p>
                )}
              </div>
            )}

            {/* Duplicate FIPPA warning */}
            {dupWarning && actionType === 'fippa_request' && (
              <div
                className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--accent-gadfly) 20%, transparent)',
                }}
              >
                <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-gadfly)' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--accent-gadfly)' }}>
                  You already have a FIPPA request for this investigation. Continue anyway?
                </p>
              </div>
            )}

            {/* Oracle document link */}
            <div>
              <label htmlFor={oracleDocId} className="mb-1.5 block text-xs font-medium text-text-secondary">
                Oracle document <span className="text-text-faint">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
              ) : (
                <div className="relative">
                  <select
                    id={oracleDocId}
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0"
                  >
                    <option value="">No document</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                </div>
              )}
            </div>

            {/* Gadfly session link */}
            <div>
              <label htmlFor={gadflyInquiryId} className="mb-1.5 block text-xs font-medium text-text-secondary">
                Gadfly inquiry <span className="text-text-faint">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
              ) : (
                <div className="relative">
                  <select
                    id={gadflyInquiryId}
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0"
                  >
                    <option value="">No inquiry</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="action-description" className="mb-1.5 block text-xs font-medium text-text-secondary">
                {actionType === 'fippa_request'
                  ? 'What records do you want?'
                  : actionType === 'public_comment'
                  ? 'What is your concern?'
                  : 'What policy topic?'}
              </label>
              <textarea
                ref={descriptionRef}
                id="action-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDERS[actionType]}
                rows={4}
                className="w-full resize-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:border-[var(--accent-lever)]/40"
              />
            </div>
          </div>

          {/* Error alert (failures not tied to a field) */}
          {createError && (
            <p ref={createErrorRef} role="alert" tabIndex={-1} className="mt-4 text-xs text-status-danger outline-none">
              {createError}
            </p>
          )}

          {/* Why Generate is unavailable: the province select may be off-screen */}
          {showGenerateReason && (
            <p id={generateReasonId} className="mt-4 text-right text-xs text-text-muted">
              Choose a province to generate this request.
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={handleCreate}
              // aria-disabled, never disabled: the button keeps focus while
              // busy and stays reachable while incomplete. creatingRef blocks
              // a second send; handleCreate routes an incomplete activation.
              aria-disabled={loading || !canCreate}
              aria-busy={loading || undefined}
              aria-describedby={showGenerateReason ? generateReasonId : undefined}
              className={clsx(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-150',
                loading
                  ? 'cursor-progress'
                  : !canCreate
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:opacity-90'
              )}
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-lever) 20%, transparent)',
                color: 'var(--accent-lever)',
                border: '1px solid color-mix(in srgb, var(--accent-lever) 30%, transparent)',
              }}
            >
              {loading ? 'Creating...' : 'Generate'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
