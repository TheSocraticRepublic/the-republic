'use client'

import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { BC_PUBLIC_BODIES } from '@/lib/lever/public-bodies'
import { leverActionTypeEnum } from '@/lib/db/schema'

interface Document {
  id: string
  title: string
  status: string
}

interface Session {
  id: string
  title: string
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
}

export function NewActionDialog({ initialDocumentId, initialSessionId }: NewActionDialogProps = {}) {
  const [open, setOpen] = useState(!!(initialDocumentId || initialSessionId))
  const [actionType, setActionType] = useState<ActionType>('fippa_request')
  const [publicBodyName, setPublicBodyName] = useState('')
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [selectedSessionId, setSelectedSessionId] = useState(initialSessionId ?? '')
  const [description, setDescription] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingContext, setFetchingContext] = useState(false)
  const router = useRouter()

  // Fetch documents and sessions when dialog opens
  useEffect(() => {
    if (!open) return
    setFetchingContext(true)

    Promise.all([
      fetch('/api/oracle/documents').then((r) => r.json()).catch(() => ({ documents: [] })),
      fetch('/api/gadfly/session').then((r) => r.json()).catch(() => ({ sessions: [] })),
    ]).then(([docsData, sessionsData]) => {
      const ready = (docsData.documents ?? []).filter((d: Document) => d.status === 'ready')
      setDocuments(ready)
      setSessions(sessionsData.sessions ?? [])
    }).finally(() => setFetchingContext(false))
  }, [open])

  const handleCreate = useCallback(async () => {
    if (!description.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/lever/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          publicBodyName: actionType === 'fippa_request' && publicBodyName ? publicBodyName : undefined,
          documentId: selectedDocId || undefined,
          sessionId: selectedSessionId || undefined,
          description: description.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create action')
      setOpen(false)
      router.push(`/lever/${data.actionId}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [actionType, publicBodyName, selectedDocId, selectedSessionId, description, router])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) {
      setActionType('fippa_request')
      setPublicBodyName('')
      setSelectedDocId('')
      setSelectedSessionId('')
      setDescription('')
    }
  }, [])

  // When pre-filled from cross-arm nav, trigger document/session fetch on mount
  // The existing useEffect already handles this when open=true

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: 'rgba(200, 91, 91, 0.15)',
            color: '#C85B5B',
            border: '1px solid rgba(200, 91, 91, 0.25)',
          }}
        >
          <Plus size={14} strokeWidth={2} />
          New Action
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.1] bg-neutral-950 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-neutral-100"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              New Civic Action
            </Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-300">
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Action type selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Document type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActionType(t.value)}
                    className={clsx(
                      'rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150 text-left',
                      actionType === t.value
                        ? 'border-[#C85B5B]/40 bg-[#C85B5B]/10 text-[#C85B5B]'
                        : 'border-white/[0.08] bg-black/40 text-neutral-500 hover:border-white/[0.15] hover:text-neutral-300'
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
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Public body <span className="text-neutral-600">(BC)</span>
                </label>
                <div className="relative">
                  <select
                    value={publicBodyName}
                    onChange={(e) => setPublicBodyName(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#C85B5B]/40 focus:ring-0"
                  >
                    <option value="">Select a public body...</option>
                    {BC_PUBLIC_BODIES.map((pb) => (
                      <option key={pb.jurisdiction} value={pb.name}>
                        {pb.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  />
                </div>
              </div>
            )}

            {/* Oracle document link */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Oracle document <span className="text-neutral-600">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#C85B5B]/40 focus:ring-0"
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
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  />
                </div>
              )}
            </div>

            {/* Gadfly session link */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Gadfly inquiry <span className="text-neutral-600">(optional)</span>
              </label>
              {fetchingContext ? (
                <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#C85B5B]/40 focus:ring-0"
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
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                {actionType === 'fippa_request'
                  ? 'What records do you want?'
                  : actionType === 'public_comment'
                  ? 'What is your concern?'
                  : 'What policy topic?'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDERS[actionType]}
                rows={4}
                className="w-full resize-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-[#C85B5B]/40"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300">
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
                backgroundColor: 'rgba(200, 91, 91, 0.2)',
                color: '#C85B5B',
                border: '1px solid rgba(200, 91, 91, 0.3)',
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
