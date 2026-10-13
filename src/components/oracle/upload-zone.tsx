'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useCoarsePointer } from '@/lib/ui/input-modality'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error'

export function UploadZone() {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  // A phone cannot drag a file, so on a coarse pointer the zone says what a
  // tap does instead (mobile P1-4).
  const coarsePointer = useCoarsePointer()

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.')
      setState('error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10MB limit.')
      setState('error')
      return
    }

    setState('uploading')
    setError(null)
    setProgress('Uploading...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/oracle/ingest', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Upload failed')
      }

      setProgress('Processing complete')
      router.push(`/oracle/${data.documentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setState('error')
    }
  }, [router])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleUpload(file)
    },
    [handleUpload]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleUpload(file)
    },
    [handleUpload]
  )

  const isUploading = state === 'uploading'

  // The whole zone is the file input's <label>: a tap or click anywhere on it
  // opens the file picker, and it is never shorter than a 44px touch target
  // (mobile P1-4). The input inside stays the one tab stop, named for screen
  // readers (app-arms P2-11); its focus ring is drawn on the zone.
  return (
    <label
      htmlFor="oracle-file"
      className={clsx(
        'relative flex min-h-11 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 transition-all duration-150',
        isUploading ? 'cursor-default' : 'cursor-pointer',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--accent-oracle)]',
        state === 'dragging'
          ? 'border-[var(--accent-oracle)]/60 bg-[var(--accent-oracle)]/[0.06]'
          : state === 'error'
          ? 'border-status-danger/40 bg-status-danger/[0.04]'
          : 'border-border bg-surface-1 hover:border-border-strong hover:bg-surface-3'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isUploading) setState('dragging')
      }}
      onDragLeave={() => {
        if (!isUploading) setState('idle')
      }}
      onDrop={handleDrop}
    >
      {/* Icon */}
      <span
        className="flex h-12 w-12 items-center justify-center rounded-xl border"
        style={{
          borderColor: 'color-mix(in srgb, var(--accent-oracle) 25%, transparent)',
          backgroundColor: 'color-mix(in srgb, var(--accent-oracle) 8%, transparent)',
        }}
      >
        {isUploading ? (
          <Loader2 size={22} strokeWidth={1.75} style={{ color: 'var(--accent-oracle)' }} className="animate-spin" />
        ) : state === 'error' ? (
          <FileText size={22} strokeWidth={1.75} className="text-status-danger" />
        ) : (
          <Upload size={22} strokeWidth={1.75} style={{ color: 'var(--accent-oracle)' }} />
        )}
      </span>

      {/* Text */}
      <div className="text-center">
        {isUploading ? (
          <p className="text-sm text-text-secondary">{progress}</p>
        ) : state === 'error' ? (
          <>
            <p className="text-sm font-medium text-status-danger">{error}</p>
            <button
              type="button"
              className="mt-2 text-xs text-text-muted underline underline-offset-2 hover:text-text-secondary transition-colors"
              onClick={() => {
                setState('idle')
                setError(null)
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            {coarsePointer ? (
              <p className="text-sm font-medium" style={{ color: 'var(--accent-oracle)' }}>
                Choose a PDF
              </p>
            ) : (
              <p className="text-sm font-medium text-text-primary">
                Drop a PDF here or{' '}
                <span className="underline-offset-2 hover:underline" style={{ color: 'var(--accent-oracle)' }}>
                  browse
                </span>
              </p>
            )}
            <p className="mt-1 text-xs text-text-muted">Government documents only. Max 10MB.</p>
          </>
        )}
      </div>

      <input
        id="oracle-file"
        type="file"
        aria-label="Upload a government PDF, 10 MB maximum"
        accept=".pdf"
        className="sr-only"
        onChange={handleChange}
        disabled={isUploading}
      />
    </label>
  )
}
