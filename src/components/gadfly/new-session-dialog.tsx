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

export function NewSessionDialog() {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'socratic' | 'direct'>('socratic')
  const [loading, setLoading] = useState(false)
  const [fetchingDocs, setFetchingDocs] = useState(false)
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
    } finally {
      setLoading(false)
    }
  }, [selectedDocId, title, mode, router])

  const handleOpenChange = useCallback((v: boolean) => {
    setOpen(v)
    if (!v) {
      setSelectedDocId('')
      setTitle('')
      setMode('socratic')
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
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.1] bg-neutral-950 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title
              className="text-base font-semibold text-neutral-100"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              Begin Inquiry
            </Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-300">
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Document selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Document <span className="text-neutral-600">(optional)</span>
              </label>
              {fetchingDocs ? (
                <div className="h-9 animate-pulse rounded-lg bg-white/[0.04]" />
              ) : (
                <div className="relative">
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 pr-8 text-sm text-neutral-200 outline-none focus:border-[#C8A84B]/40 focus:ring-0"
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
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                  />
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Title <span className="text-neutral-600">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  selectedDocId
                    ? 'Auto-generated from document title'
                    : 'New Inquiry'
                }
                className="w-full rounded-lg border border-white/[0.1] bg-black/60 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-[#C8A84B]/40"
              />
            </div>

            {/* Mode selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(['socratic', 'direct'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      'rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      mode === m
                        ? 'border-[#C8A84B]/40 bg-[#C8A84B]/10 text-[#C8A84B]'
                        : 'border-white/[0.08] bg-black/40 text-neutral-500 hover:border-white/[0.15] hover:text-neutral-300'
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

          {/* Action */}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300">
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
