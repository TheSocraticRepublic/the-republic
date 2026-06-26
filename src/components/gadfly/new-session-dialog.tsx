'use client'

import { useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

interface Document {
  id: string
  title: string
  status: string
}

interface NewSessionDialogProps {
  initialDocumentId?: string
  initialTitle?: string
}

export function NewSessionDialog({ initialDocumentId, initialTitle }: NewSessionDialogProps = {}) {
  // Auto-open when pre-filled from cross-arm navigation
  const [open, setOpen] = useState(!!initialDocumentId)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [title, setTitle] = useState(initialTitle ?? '')
  const [mode, setMode] = useState<'socratic' | 'direct'>('socratic')
  const [loading, setLoading] = useState(false)
  const [fetchingDocs, setFetchingDocs] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const router = useRouter()

  // Fetch user documents when dialog opens
  useEffect(() => {
    if (!open) return
    setFetchingDocs(true)
    fetch('/api/oracle/documents')
      .then((r) => r.json())
      .then((data) => {
        const ready = (data.documents ?? []).filter((d: Document) => d.status === 'ready')
        setDocuments(ready)
      })
      .catch(() => {})
      .finally(() => setFetchingDocs(false))
  }, [open])

  const handleCreate = useCallback(async () => {
    setLoading(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/gadfly/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId || undefined,
          title: title.trim() || undefined,
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session')
      setOpen(false)
      router.push(`/gadfly/${data.sessionId}`)
    } catch (err) {
      console.error(err)
      setCreateError('Failed to create inquiry. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [selectedDocId, title, mode, router])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) {
      // Reset to empty (not initial values) after dialog is closed
      setSelectedDocId('')
      setTitle('')
      setMode('socratic')
      setCreateError(null)
    }
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: 'rgba(200, 168, 75, 0.15)',
            color: '#C8A84B',
            border: '1px solid rgba(200, 168, 75, 0.25)',
          }}
        >
          <Plus size={14} strokeWidth={2} />
          New Inquiry
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-text-primary"
            >
              Begin Inquiry
            </Dialog.Title>
            <Dialog.Close aria-label="Close dialog" className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary">
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Document selector */}
            <div>
              <label htmlFor="session-document" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Document <span className="text-text-faint">(optional)</span>
              </label>
              {fetchingDocs ? (
                <div className="h-9 animate-pulse rounded-lg bg-surface-1" />
              ) : (
                <div className="relative">
                  <select
                    id="session-document"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-[#C8A84B]/40 focus:ring-0"
                  >
                    <option value="">No document — open inquiry</option>
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

            {/* Title */}
            <div>
              <label htmlFor="session-title" className="mb-1.5 block text-xs font-medium text-text-secondary">
                Title <span className="text-text-faint">(optional)</span>
              </label>
              <input
                id="session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  selectedDocId
                    ? 'Auto-generated from document title'
                    : 'New Inquiry'
                }
                className="w-full rounded-lg border border-border-strong bg-surface-1 shadow-sm px-3 py-2 text-sm text-text-primary placeholder-text-faint outline-none focus:border-[#C8A84B]/40"
              />
            </div>

            {/* Mode selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(['socratic', 'direct'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      mode === m
                        ? 'border-[#C8A84B]/40 bg-[#C8A84B]/10 text-[#C8A84B]'
                        : 'border-border bg-surface-1 text-text-muted hover:border-border-strong hover:text-text-secondary'
                    )}
                  >
                    <span className="block font-medium capitalize">{m}</span>
                    <span className="block text-[10px] opacity-70">
                      {m === 'socratic' ? 'Questions only' : 'Direct dialogue'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error alert */}
          {createError && (
            <p role="alert" className="mt-4 text-xs text-red-400">{createError}</p>
          )}

          {/* Action */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={loading}
              className={clsx(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-150',
                loading
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:opacity-90',
              )}
              style={{
                backgroundColor: 'rgba(200, 168, 75, 0.2)',
                color: '#C8A84B',
                border: '1px solid rgba(200, 168, 75, 0.3)',
              }}
            >
              {loading ? 'Creating...' : 'Begin Inquiry'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
