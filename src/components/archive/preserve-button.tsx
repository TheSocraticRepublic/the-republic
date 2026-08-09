'use client'

import { useState, useCallback, useId } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface PreserveButtonProps {
  investigationId: string
}

export function PreserveButton({ investigationId }: PreserveButtonProps) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const checkboxId = useId()
  const descId = useId()

  const reset = useCallback(() => {
    setConfirmed(false)
    setError(null)
    setLoading(false)
  }, [])

  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v)
      if (!v) reset()
    },
    [reset]
  )

  async function handlePreserve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/archive/${investigationId}`, {
        method: 'POST',
      })
      if (res.ok) {
        setOpen(false)
        reset()
        router.refresh()
      } else {
        let message = 'Preservation failed. Try again.'
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch {
          // keep default message
        }
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 disabled:opacity-50 bg-surface-3 border border-border-strong text-text-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong">
          Preserve to Archive
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          aria-describedby={descId}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface-1 p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-text-primary">
              Before you preserve
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cancel preservation"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3 hover:text-text-secondary"
            >
              <X size={14} strokeWidth={2} />
            </Dialog.Close>
          </div>

          <div id={descId} className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              Archiving pins this investigation to a permanent public record.
              Once preserved, it cannot be deleted, edited, or retracted
              — including by you, including after you delete your account.
            </p>
            <p>
              The preserved bundle includes your concern text, the briefing,
              and up to 50,000 characters of each document you attached.
            </p>
            <p>
              The permanent copy carries no account identity. The archive page
              on this site separately credits your display name while your
              account exists, and shows &ldquo;Account deleted&rdquo; if you
              later remove it.
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor={checkboxId}
              className="flex items-start gap-3 cursor-pointer select-none"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border-strong bg-surface-1 accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
              />
              <span className="text-sm text-text-secondary">
                I understand this is permanent and public.
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-xs text-status-danger">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close className="rounded-lg px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              onClick={handlePreserve}
              disabled={!confirmed || loading}
              aria-disabled={!confirmed || loading}
              className={clsx(
                'rounded-lg px-5 py-2 text-sm font-medium transition-all duration-150 border',
                !confirmed || loading
                  ? 'cursor-not-allowed opacity-40 border-border text-text-muted'
                  : 'border-white/20 bg-white/10 text-text-primary hover:bg-white/15'
              )}
            >
              {loading ? 'Preserving...' : 'Preserve'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
