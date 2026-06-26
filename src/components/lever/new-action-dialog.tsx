'use client'

import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { bcPublicBodies as BC_PUBLIC_BODIES } from '@/lib/jurisdictions/bc/public-bodies'
import { leverActionTypeEnum } from '@/lib/db/schema'
import type { PublicBody } from '@/lib/jurisdictions/types'

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
  { value: 'fippa_request', label: 'FIPPA Request', description: 'Freedom of Information' },
  { value: 'public_comment', label: 'Public Comment', description: 'Council or agency' },
  { value: 'policy_brief', label: 'Policy Brief', description: 'Evidence-based proposal' },
]

const DESCRIPTION_PLACEHOLDERS: Partial<Record<ActionType, string>> = {
  fippa_request: 'What records do you want to request?',
  public_comment: "What is your concern or position on the proposed bylaw, permit, or policy?",
  policy_brief: 'What policy problem are you addressing and what change do you recommend?',
}

interface NewActionDialogProps {
  initialDocumentId?: string
  initialSessionId?: string
  initialInvestigationId?: string
  initialActionType?: string
}

export function NewActionDialog({
  initialDocumentId,
  initialSessionId,
  initialInvestigationId,
  initialActionType,
}: NewActionDialogProps = {}) {
  const [open, setOpen] = useState(!!(initialDocumentId || initialSessionId || initialInvestigationId))
  const [actionType, setActionType] = useState<ActionType>(
    (initialActionType as ActionType) || 'fippa_request'
  )
  const [publicBodyName, setPublicBodyName] = useState('')
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId ?? '')
  const [investigationId] = useState(initialInvestigationId ?? '')
  const [description, setDescription] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [publicBodies, setPublicBodies] = useState<PublicBody[]>(BC_PUBLIC_BODIES)
  const [jurisdictionLabel, setJurisdictionLabel] = useState('BC')
  const [loading, setLoading] = useState(false)
  const [fetchingContext, setFetchingContext] = useState(false)
  const [dupWarning, setDupWarning] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const router = useRouter()

  // Fetch documents, sessions, and jurisdiction-aware public bodies when dialog opens
  useEffect(() => {
    if (!open) return
    setFetchingContext(true)

    type ContextResponse = {
      documents?: Document[]
      sessions?: Session[]
      investigation?: { jurisdictionName?: string | null }
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

      // Resolve jurisdiction from investigation's jurisdictionName
      if (investigationData?.investigation) {
        const inv = investigationData.investigation
        const jName = (inv.jurisdictionName ?? '').toLowerCase()

        // Map province strings from jurisdictionName to module keys
        let resolvedBodies: PublicBody[] = BC_PUBLIC_BODIES
        let label = 'BC'

        if (jName.includes('british columbia')) {
          // Already defaults to BC
        } else if (jName.includes('alberta')) {
          try {
            const abMod = await import('@/lib/jurisdictions/ab/public-bodies')
            resolvedBodies = abMod.abPublicBodies
            label = 'AB'
          } catch { /* fall through to BC */ }
        } else if (jName.includes('ontario')) {
          try {
            const onMod = await import('@/lib/jurisdictions/on/public-bodies')
            resolvedBodies = onMod.onPublicBodies
            label = 'ON'
          } catch { /* fall through to BC */ }
        }

        setPublicBodies(resolvedBodies)
        setJurisdictionLabel(label)
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

  const handleCreate = useCallback(async () => {
    if (!description.trim()) return
    setLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/lever/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          publicBodyName: actionType === 'fippa_request' && publicBodyName ? publicBodyName : undefined,
          documentId: selectedDocId || undefined,
          sessionId: selectedSessionId || undefined,
          investigationId: investigationId || undefined,
          description: description.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create action')
      setOpen(false)
      router.push(`/lever/${data.actionId}`)
    } catch (err) {
      console.error(err)
      setCreateError('Failed to create action. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [actionType, publicBodyName, selectedDocId, selectedSessionId, investigationId, description, router])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) {
      setActionType((initialActionType as ActionType) || 'fippa_request')
      setPublicBodyName('')
      setSelectedDocId('')
      setSelectedSessionId('')
      setDescription('')
      setDupWarning(false)
      setCreateError(null)
    }
  }, [initialActionType])

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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActionType(t.value)}
                    className={clsx(
                      'rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 text-left',
                      actionType === t.value
                        ? 'border-[var(--accent-lever)]/40 bg-[var(--accent-lever)]/10 text-[var(--accent-lever)]'
                        : 'border-border bg-surface-1 text-text-muted hover:border-border-strong hover:text-text-secondary'
                    )}
                  >
                    <span className="block font-semibold">{t.label}</span>
                    <span className="mt-0.5 block text-[10px] opacity-70">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Public body selector — FIPPA only */}
            {actionType === 'fippa_request' && (
              <div>
                <label htmlFor="action-public-body" className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Public body <span className="text-text-faint">({jurisdictionLabel})</span>
                </label>
                <div className="relative">
                  <select
                    id="action-public-body"
                    value={publicBodyName}
                    onChange={(e) => setPublicBodyName(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[var(--accent-lever)]/40 focus:ring-0"
                  >
                    <option value="">Select a public body...</option>
                    {publicBodies.map((pb) => (
                      <option key={`${pb.jurisdiction}-${pb.name}`} value={pb.name}>
                        {pb.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                </div>
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
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Oracle document <span className="text-text-faint">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
              ) : (
                <div className="relative">
                  <select
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
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                Gadfly inquiry <span className="text-text-faint">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
              ) : (
                <div className="relative">
                  <select
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
                id="action-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDERS[actionType]}
                rows={4}
                className="w-full resize-none rounded-lg border border-border-strong bg-surface-1 px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:border-[var(--accent-lever)]/40"
              />
            </div>
          </div>

          {/* Error alert */}
          {createError && (
            <p role="alert" className="mt-4 text-xs text-red-400">{createError}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={loading || !description.trim()}
              className={clsx(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-150',
                loading || !description.trim()
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
