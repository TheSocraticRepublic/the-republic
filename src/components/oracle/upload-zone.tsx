'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error'

export function UploadZone() {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 transition-all duration-150',
        state === 'dragging'
          ? 'border-[#89B4C8]/60 bg-[#89B4C8]/[0.06]'
          : state === 'error'
          ? 'border-red-500/40 bg-red-500/[0.04]'
          : 'border-white/10 bg-black/40 hover:border-white/20 hover:bg-black/60'
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
          borderColor: 'rgba(137, 180, 200, 0.25)',
          backgroundColor: 'rgba(137, 180, 200, 0.08)',
        }}
      >
        {isUploading ? (
          <Loader2 size={22} strokeWidth={1.75} style={{ color: '#89B4C8' }} className="animate-spin" />
        ) : state === 'error' ? (
          <FileText size={22} strokeWidth={1.75} className="text-red-400" />
        ) : (
          <Upload size={22} strokeWidth={1.75} style={{ color: '#89B4C8' }} />
        )}
      </span>

      {/* Text */}
      <div className="text-center">
        {isUploading ? (
          <p className="text-sm text-neutral-300">{progress}</p>
        ) : state === 'error' ? (
          <>
            <p className="text-sm font-medium text-red-400">{error}</p>
            <button
              className="mt-2 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300 transition-colors"
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
            <p className="text-sm font-medium text-neutral-200">
              Drop a PDF here or{' '}
              <button
                className="text-[#89B4C8] hover:underline underline-offset-2 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-neutral-500">Government documents only. Max 10MB.</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="sr-only"
        onChange={handleChange}
        disabled={isUploading}
      />
    </div>
  )
}
