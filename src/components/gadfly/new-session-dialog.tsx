'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, ChevronDown, Loader2, MessageCircleQuestion } from 'lucide-react'
import { CTAButton } from '@/components/ui/cta-button'
import { ErrorMark, Field, FieldLabel, fieldControlClass, fieldToggleClasses } from '@/components/ui/field'

interface Document {
  id: string
  title: string
  status: string
}

interface NewSessionDialogProps {
  initialDocumentId?: string
  initialTitle?: string
  /** Open on arrival: the landing's empty state links to `/gadfly?new=1`
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

export function NewSessionDialog({ initialDocumentId, initialTitle, initialOpen }: NewSessionDialogProps = {}) {
  // The address is the truth for ?new=1, not the page's prop: Back restores
  // a cached render whose prop still says open, while the entry it lands on
  // no longer carries the flag (measured on the harness after a create).
  const urlFlag = useSearchParams().get('new') === '1'
  const flagged = !!initialOpen && urlFlag
  // Auto-open when pre-filled from cross-arm navigation, or asked for by ?new=1
  const [open, setOpen] = useState(!!(flagged || initialDocumentId))
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId ?? '')
  const [title, setTitle] = useState(initialTitle ?? '')
  const [mode, setMode] = useState<'socratic' | 'direct'>('socratic')
  const [loading, setLoading] = useState(false)
  const [fetchingDocs, setFetchingDocs] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const router = useRouter()
  const modeLabelId = useId()
  const documentRef = useRef<HTMLSelectElement>(null)
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
      // Synchronously, not through router.replace: a router.replace followed
      // at once by router.push is superseded by the push, which left the
      // flag in history behind the new page (measured on the harness).
      // The router is not told of this native replaceState here; it learns
      // the stripped address when the push below reads the current URL.
      // Passing history.state through keeps the router's entry intact.
      if (flagged) window.history.replaceState(window.history.state, '', withoutNewFlag())
      router.push(`/gadfly/${data.sessionId}`)
    } catch (err) {
      console.error(err)
      setCreateError('Failed to create inquiry. Try again.')
    } finally {
      setLoading(false)
    }
  }, [selectedDocId, title, mode, router, flagged])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    // Opened by ?new=1: take the flag off the address on close, so a reload
    // doesn't reopen it and the empty state's link opens it again next time.
    if (!v && flagged) clearNewFlag()
    if (!v) {
      // Reset to empty (not initial values) after dialog is closed
      setSelectedDocId('')
      setTitle('')
      setMode('socratic')
      setCreateError(null)
    }
  }, [flagged, clearNewFlag])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {/* The arm recipe, on the Gadfly room (an allowed ground for the ink). */}
      <Dialog.Trigger asChild>
        <CTAButton variant="arm" arm="gadfly">
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          New Inquiry
        </CTAButton>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          // Open on the first field, not Close (Jen C2b C9). A select opens no
          // soft keyboard on a phone.
          onOpenAutoFocus={(e) => {
            if (!documentRef.current) return
            e.preventDefault()
            documentRef.current.focus()
          }}
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-text-primary"
            >
              Begin Inquiry
            </Dialog.Title>
            <Dialog.Close aria-label="Close dialog" className="flex h-7 w-7 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary">
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Document selector */}
            {/* Mounted while the list loads (the default choice is valid at
                once, and the documents join it when they arrive), so the
                dialog's first focus has somewhere to land and keeps it. */}
            <Field id="session-document" label="Document" optional>
              {(control) => (
                  <div className="relative">
                    <select
                      {...control}
                      ref={documentRef}
                      aria-busy={fetchingDocs ? 'true' : undefined}
                      value={selectedDocId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className={fieldControlClass('select')}
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
            </Field>

            {/* Title */}
            <Field id="session-title" label="Title" optional>
              {(control) => (
                <input
                  {...control}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    selectedDocId
                      ? 'Auto-generated from document title'
                      : 'New Inquiry'
                  }
                  className={fieldControlClass()}
                />
              )}
            </Field>

            {/* Mode selector */}
            <div>
              <FieldLabel id={modeLabelId}>Mode</FieldLabel>
              <div role="group" aria-labelledby={modeLabelId} className="grid grid-cols-2 gap-2">
                {(['socratic', 'direct'] as const).map((m) => {
                  const toggle = fieldToggleClasses(mode === m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                      className={toggle.button}
                    >
                      <span className={`${toggle.label} capitalize`}>{m}</span>
                      <span className={toggle.description}>
                        {m === 'socratic' ? 'Questions only' : 'Direct dialogue'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Error alert */}
          {createError && (
            <p role="alert" className="mt-4 flex items-start gap-1.5 text-xs text-status-danger">
              <ErrorMark />
              <span>{createError}</span>
            </p>
          )}

          {/* Action */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
              Cancel
            </Dialog.Close>
            {/* The arm recipe on the dialog's dark surface-1 (an allowed ground).
                Busy, it refuses a second create and keeps focus, and keeps its
                label: only the icon turns to a spinner, so the box never
                changes and Cancel never moves into it (Jen C2b C3). */}
            <CTAButton variant="arm" arm="gadfly" onClick={handleCreate} busy={loading}>
              {loading ? (
                <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
              ) : (
                <MessageCircleQuestion size={14} strokeWidth={2} aria-hidden="true" />
              )}
              Begin Inquiry
            </CTAButton>
          </div>
          {/* The working state, for a screen reader. */}
          <p role="status" className="sr-only">
            {loading ? 'Creating the inquiry…' : ''}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
