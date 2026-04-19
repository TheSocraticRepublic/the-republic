'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { GadflySession } from '@/components/gadfly/gadfly-session'

interface GadflySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investigationId: string
  sessionId: string | null   // null = needs to be created
  concern: string
  onSessionCreated?: (sessionId: string) => void
}

interface SessionData {
  id: string
  title: string
  documentId: string | null
  mode: 'socratic' | 'direct'
  status: 'active' | 'completed' | 'abandoned'
  questionCount: number
  insightCount: number
  complexityLevel: number
}

export function GadflySheet({
  open,
  onOpenChange,
  investigationId,
  sessionId,
  concern,
  onSessionCreated,
}: GadflySheetProps) {
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(sessionId)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync external sessionId into local state
  useEffect(() => {
    if (sessionId) {
      setResolvedSessionId(sessionId)
    }
  }, [sessionId])

  // When the sheet opens and we have no session, create one
  useEffect(() => {
    if (!open) return
    if (resolvedSessionId) {
      // Fetch existing session data
      fetchSession(resolvedSessionId)
      return
    }
    if (isCreating) return

    async function createSession() {
      setIsCreating(true)
      setError(null)
      try {
        const title = concern.length > 80
          ? concern.slice(0, 80).trim() + '…'
          : concern

        const res = await fetch('/api/gadfly/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, investigationId }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? 'Failed to create session')
        }

        const data = await res.json()
        const newSessionId: string = data.sessionId
        setResolvedSessionId(newSessionId)
        onSessionCreated?.(newSessionId)
        await fetchSession(newSessionId)
      } catch (err) {
        console.error('[GadflySheet] Session create error:', err)
        setError('Could not start session. Try again.')
      } finally {
        setIsCreating(false)
      }
    }

    createSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resolvedSessionId])

  async function fetchSession(id: string) {
    try {
      const res = await fetch(`/api/gadfly/session/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setSessionData(data.session ?? null)
    } catch {
      // Non-fatal
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Dark overlay — lets the investigation page bleed through at left */}
        <Dialog.Overlay
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        />

        {/* Slide-over panel — 80vw from the right */}
        <Dialog.Content
          className="fixed top-0 right-0 z-50 h-full flex flex-col focus:outline-none"
          style={{
            width: '80vw',
            backgroundColor: '#0a0a0a',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 200ms ease-out',
          }}
        >
          {/* Header */}
          <div
            className="flex flex-shrink-0 items-center justify-between border-b px-6 py-4"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                style={{
                  backgroundColor: 'rgba(200,168,75,0.08)',
                  border: '1px solid rgba(200,168,75,0.18)',
                  color: '#C8A84B',
                }}
              >
                ?
              </span>
              <Dialog.Title
                className="text-sm font-semibold text-neutral-200"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                Socratic Inquiry
              </Dialog.Title>
            </div>

            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-neutral-300"
              aria-label="Close inquiry panel"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L13 13M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {error ? (
              <div className="flex h-full items-center justify-center px-8">
                <div className="text-center">
                  <p className="text-sm text-neutral-400">{error}</p>
                  <button
                    onClick={() => {
                      setError(null)
                      setResolvedSessionId(null)
                    }}
                    className="mt-4 text-xs text-neutral-500 underline hover:text-neutral-300"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : isCreating || !resolvedSessionId || !sessionData ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span
                    className="h-2 w-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#C8A84B' }}
                  />
                  <p className="text-xs text-neutral-600">
                    {isCreating ? 'Starting inquiry' : 'Loading session'}
                  </p>
                </div>
              </div>
            ) : (
              <GadflySession
                session={sessionData}
                initialTurns={[]}
                initialInsightsByTurn={{}}
                questionTypeCounts={{}}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
