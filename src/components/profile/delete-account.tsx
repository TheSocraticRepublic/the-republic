'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirm.trim().toUpperCase() === 'DELETE' && !busy

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('Request failed')
      }
      // Account and session are gone — leave the app.
      router.push('/')
      router.refresh()
    } catch {
      setError('Could not delete your account. Please try again, or contact us.')
      setBusy(false)
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-[var(--accent-lever)]/30 bg-[var(--accent-lever)]/5 p-6">
      <h2
        className="text-base font-semibold tracking-tight text-text-primary"
      >
        Delete account
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        Permanently removes your account and everything tied to it — investigations,
        documents, forum posts and threads, and credential records. This cannot be undone.
        Public records already archived to IPFS or Arweave are permanent and remain.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-[var(--accent-lever)]/50 px-3 py-1.5 text-xs font-medium text-[#E08585] transition-colors hover:bg-[var(--accent-lever)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lever)]/60"
        >
          Delete account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label htmlFor="delete-confirm" className="block text-xs text-text-secondary">
            Type <span className="font-semibold text-text-primary">DELETE</span> to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lever)]/60"
          />
          {error && (
            <p role="alert" className="text-xs text-[#E08585]">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="rounded-lg bg-[var(--accent-lever)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-lever)]/60"
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setConfirm('')
                setError(null)
              }}
              disabled={busy}
              className="text-xs text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
