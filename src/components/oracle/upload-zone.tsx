'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error'

export function UploadZone() {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

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
      // Clear the input once the file is read, so choosing the same file
      // again (after a refusal or a failed upload) fires change again.
      e.target.value = ''
      if (file) handleUpload(file)
    },
    [handleUpload]
  )

  const isUploading = state === 'uploading'
  const isError = state === 'error'

  /*
   * The zone's box holds two things: the file input's <label>, which fills it
   * (a tap or click anywhere on it opens the picker, never shorter than a
   * 44px target, mobile P1-4), and, in the error state only, "Try again".
   * The button is a sibling of the label, never inside it: a label forwards a
   * click to its input unless the click landed on interactive content inside
   * it, and React unmounts the button before older engines (WebKit, Chromium
   * before M145) make that check, so a button inside opened the picker.
   *
   * The input is the zone's one tab stop; its focus ring is drawn on the box
   * in the app's focus-ring recipe (2px, offset 2px, --focus-ring). Its name
   * starts with the coarse-pointer copy, "Choose a PDF" (WCAG 2.5.3).
   *
   * The copy is chosen by CSS (`pointer-coarse:`), not script, so the server
   * render is already right on a phone: no "Drop a PDF here" until hydration.
   */
  return (
    <div
      className={clsx(
        'group relative flex flex-col items-center rounded-xl border-2 border-dashed transition-all duration-150',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[color:var(--focus-ring)]',
        state === 'dragging'
          ? 'border-[var(--accent-oracle)]/60 bg-[var(--accent-oracle)]/[0.06]'
          : isError
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
      <label
        htmlFor="oracle-file"
        className={clsx(
          'flex min-h-11 w-full flex-col items-center justify-center gap-4 px-10 pt-10',
          isError ? 'pb-2' : 'pb-10',
          isUploading ? 'cursor-default' : 'cursor-pointer'
        )}
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
          ) : isError ? (
            <FileText size={22} strokeWidth={1.75} className="text-status-danger" />
          ) : (
            <Upload size={22} strokeWidth={1.75} style={{ color: 'var(--accent-oracle)' }} />
          )}
        </span>

        {/* Text (spans: a label holds phrasing content only) */}
        <span className="block text-center">
          {isUploading ? (
            <span className="block text-sm text-text-secondary">{progress}</span>
          ) : isError ? (
            <span className="block text-sm font-medium text-status-danger">{error}</span>
          ) : (
            <>
              <span
                data-pointer-copy="fine"
                className="block text-sm font-medium text-text-primary pointer-coarse:hidden"
              >
                Drop a PDF here or{' '}
                <span className="underline-offset-2 group-hover:underline" style={{ color: 'var(--accent-oracle)' }}>
                  browse
                </span>
              </span>
              <span
                data-pointer-copy="coarse"
                className="hidden text-sm font-medium pointer-coarse:block"
                style={{ color: 'var(--accent-oracle)' }}
              >
                Choose a PDF
              </span>
              <span className="mt-1 block text-xs text-text-muted">Government documents only. Max 10MB.</span>
            </>
          )}
        </span>

        <input
          ref={inputRef}
          id="oracle-file"
          type="file"
          aria-label="Choose a PDF, government documents only, 10 MB maximum"
          accept=".pdf"
          className="sr-only"
          onChange={handleChange}
          disabled={isUploading}
        />
      </label>

      {isError && (
        <button
          type="button"
          className="mb-10 text-xs text-text-muted underline underline-offset-2 hover:text-text-secondary transition-colors"
          onClick={() => {
            setState('idle')
            setError(null)
            // The button unmounts with the error state; keep the place on the
            // zone's input rather than dropping focus to the body.
            inputRef.current?.focus()
          }}
        >
          Try again
        </button>
      )}
    </div>
  )
}
