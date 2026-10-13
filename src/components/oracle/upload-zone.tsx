'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error'

const MAX_BYTES = 10 * 1024 * 1024

/*
 * Error copy (plain-instructional, Jen C4). Mapped on the client from the
 * status; a server or browser string is never rendered, and a failed
 * response's body is never parsed (an HTML 502 would throw a SyntaxError).
 * The 429 window is true: the ingest limiter allows 5 per sliding 60 s per
 * user. The 500 says "process", not "read": the route's catch also covers
 * chunking, embedding and the database writes.
 */
export const UPLOAD_COPY = {
  notPdf: "That file isn't a PDF.",
  tooBig: 'That PDF is over 10 MB.',
  badRequest: "Open Cave couldn't receive that file. Choose it again.",
  rateLimited: 'Too many uploads in the last minute. Wait a minute, then choose the PDF again.',
  processFailed: "Open Cave couldn't process that PDF. Choose it again, or choose another.",
  uploadFailed: "Open Cave couldn't upload that PDF. Choose it again.",
  offline: "Open Cave can't be reached. Check your connection, then choose the PDF again.",
} as const

/** The message for a failed ingest response, by status alone. */
export function uploadErrorMessage(status: number): string {
  if (status === 400) return UPLOAD_COPY.badRequest
  if (status === 413) return UPLOAD_COPY.tooBig
  if (status === 429) return UPLOAD_COPY.rateLimited
  if (status === 500) return UPLOAD_COPY.processFailed
  return UPLOAD_COPY.uploadFailed
}

/** A signed-out upload goes to login and comes back here (the B3a path). */
const LOGIN_FOR_ORACLE = '/login?redirect=%2Foracle'

export function UploadZone() {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Bumped on every failure, so the alert remounts and the same refusal
  // twice is announced twice.
  const [attempt, setAttempt] = useState(0)
  // Read by the handlers synchronously: a second pick or drop that arrives
  // before the busy render must still be refused.
  const busyRef = useRef(false)
  const router = useRouter()

  const fail = useCallback((message: string) => {
    busyRef.current = false
    setError(message)
    setAttempt((n) => n + 1)
    setState('error')
  }, [])

  // Every pick and drop comes through here; while one upload is in flight,
  // another is refused (Jen C3).
  const handleUpload = useCallback(async (file: File) => {
    if (busyRef.current) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      fail(UPLOAD_COPY.notPdf)
      return
    }

    if (file.size > MAX_BYTES) {
      fail(UPLOAD_COPY.tooBig)
      return
    }

    busyRef.current = true
    setState('uploading')
    setError(null)
    setProgress('Uploading…')

    const formData = new FormData()
    formData.append('file', file)

    let res: Response
    try {
      res = await fetch('/api/oracle/ingest', {
        method: 'POST',
        body: formData,
      })
    } catch {
      fail(UPLOAD_COPY.offline)
      return
    }

    if (res.status === 401) {
      router.push(LOGIN_FOR_ORACLE)
      return
    }
    if (!res.ok) {
      fail(uploadErrorMessage(res.status))
      return
    }

    const data = (await res.json().catch(() => null)) as { documentId?: unknown } | null
    if (!data || typeof data.documentId !== 'string') {
      console.error('[oracle] ingest returned no documentId')
      fail(UPLOAD_COPY.uploadFailed)
      return
    }

    setProgress('Processing complete')
    router.push(`/oracle/${data.documentId}`)
  }, [fail, router])

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
  const describedBy = isUploading ? undefined : isError ? 'oracle-file-error oracle-file-limits' : 'oracle-file-limits'

  /*
   * The zone's box is a <div>; the file input's <label> fills it, so a tap or
   * click anywhere opens the picker, and it is never shorter than a 44px
   * target (mobile P1-4). The box holds no other control: after a failure
   * the zone itself is the retry, and the error is shown above its own
   * instructions, announced (`role="alert"`) and in the input's description
   * (Jen C2).
   *
   * The input is the zone's one tab stop; its focus ring is drawn on the box
   * in the app's focus-ring recipe (2px, offset 2px, --focus-ring). Its name
   * is exactly "Choose a PDF", the words every pointer's action line begins
   * with (WCAG 2.5.3, Jen C1); the limits are its description. While busy it
   * is `aria-disabled`, never natively disabled, so focus stays on it through
   * the request and after a failure (Jen C3); its click is refused instead.
   *
   * The action copy is chosen by CSS (`pointer-coarse:`), not script, so the
   * server render is already right on a phone.
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
        if (!busyRef.current) setState('dragging')
      }}
      onDragLeave={() => {
        if (!busyRef.current) setState(error ? 'error' : 'idle')
      }}
      onDrop={handleDrop}
    >
      <label
        htmlFor="oracle-file"
        className={clsx(
          'flex min-h-11 w-full flex-col items-center justify-center gap-4 p-10',
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
            <span role="status" className="block text-sm text-text-secondary">{progress}</span>
          ) : (
            <>
              {isError && (
                <span
                  key={attempt}
                  id="oracle-file-error"
                  role="alert"
                  className="block text-sm font-medium text-status-danger text-pretty"
                >
                  {error}
                </span>
              )}
              <span
                data-pointer-copy="fine"
                className={clsx('block text-sm font-medium text-text-primary pointer-coarse:hidden', isError && 'mt-1')}
              >
                <span className="underline-offset-2 group-hover:underline" style={{ color: 'var(--accent-oracle)' }}>
                  Choose a PDF
                </span>{' '}
                or drop one here
              </span>
              <span
                data-pointer-copy="coarse"
                className={clsx('hidden text-sm font-medium pointer-coarse:block', isError && 'mt-1')}
                style={{ color: 'var(--accent-oracle)' }}
              >
                Choose a PDF
              </span>
              <span id="oracle-file-limits" className="mt-1 block text-xs text-text-muted">
                Government documents only. Max 10 MB.
              </span>
            </>
          )}
        </span>

        <input
          id="oracle-file"
          type="file"
          aria-label="Choose a PDF"
          aria-describedby={describedBy}
          aria-disabled={isUploading || undefined}
          accept=".pdf"
          className="sr-only"
          onClick={(e) => {
            // Busy: no picker (a press on the label arrives here too).
            if (busyRef.current) e.preventDefault()
          }}
          onChange={handleChange}
        />
      </label>
    </div>
  )
}
