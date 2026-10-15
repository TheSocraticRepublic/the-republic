'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { safeRedirectTarget } from '@/lib/navigation/safe-redirect'
import { clearSignedOutNotice, noteSignedOutByServer, useUnsavedWork } from '@/lib/auth/client-sign-out'
import { hasCoarsePointer } from '@/lib/ui/input-modality'
import { ErrorMark } from '@/components/ui/field'

/** Claim answered 401 (Jen C3 C7): never the server's "Unauthorized". The
 *  shell's notice carries the way back in. */
const CLAIM_SIGNED_OUT_MESSAGE = "You're signed out, so your name wasn't saved. What you typed is still here."

function ProfileSetupForm() {
  const searchParams = useSearchParams()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEdit, setIsEdit] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  // What the form opened with (empty for a new profile), so typing that has
  // not been saved counts as unsaved work (Razor C3 W2).
  const [saved, setSaved] = useState({ displayName: '', bio: '' })
  useUnsavedWork(!loading && (displayName !== saved.displayName || bio !== saved.bio))

  // Validate display name live. Names are stored lowercase — input is auto-lowercased.
  function validateName(name: string): string | null {
    if (name.length === 0) return null
    if (name.length < 3) return 'At least 3 characters required'
    if (name.length > 50) return 'Maximum 50 characters'
    if (!/^[a-z0-9_-]+$/.test(name)) return 'Lowercase letters, numbers, underscores, and hyphens only'
    return null
  }

  useEffect(() => {
    async function checkExistingProfile() {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.profile) {
          setIsEdit(true)
          setDisplayName(data.profile.displayName ?? '')
          setBio(data.profile.bio ?? '')
          setSaved({ displayName: data.profile.displayName ?? '', bio: data.profile.bio ?? '' })
        }
      } catch {
        // If fetch fails, proceed as new profile
      } finally {
        setLoading(false)
      }
    }
    checkExistingProfile()
  }, [])

  function handleNameChange(value: string) {
    const lowercased = value.toLowerCase()
    setDisplayName(lowercased)
    setNameError(validateName(lowercased))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    const nameErr = validateName(displayName)
    if (nameErr) {
      setNameError(nameErr)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit
        ? { displayName, bio }
        : { displayName, bio }

      const res = await fetch('/api/profile', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        noteSignedOutByServer()
        setError(CLAIM_SIGNED_OUT_MESSAGE)
        return
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong')
      }

      clearSignedOutNotice()
      // An absolute URL already checked against this origin; never a relative
      // string the browser could re-read as another host.
      window.location.assign(
        safeRedirectTarget(searchParams.get('redirect'), window.location.origin),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // Fine pointers start in the name field; a touch screen focuses nothing on
  // load, so the keyboard doesn't cover a page not yet read (Jen C3 C9,
  // mobile P2-11). The same check as the login.
  useEffect(() => {
    if (!loading && !hasCoarsePointer()) nameRef.current?.focus()
  }, [loading])

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-surface-0">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    )
  }

  // min-h-full, not min-h-screen: the page sits under the shell's header (the
  // onboarding variant's wordmark and Sign out, UI plan C3), and a full
  // screen of height below it scrolled for nothing.
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          {/* One heading style for both modes, in Fraunces (app-arms P1-6,
              Jen C3 C8). First run says where the citizen is and that this
              is the one step left, in the threshold's convivial-plain voice. */}
          <h1 className="mb-2 font-display text-2xl font-semibold tracking-[-0.01em] text-text-primary">
            {isEdit ? 'Edit Profile' : 'Welcome to Open Cave'}
          </h1>
          <p className="text-pretty text-sm text-text-muted">
            {isEdit
              ? 'Update your public display name and bio'
              : 'One step before you start: choose the name other citizens will see. Your email stays private.'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border-strong bg-surface-1 p-6 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name */}
            <div>
              <label
                htmlFor="displayName"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                required
                ref={nameRef}
                maxLength={50}
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="citizen_42"
                className="w-full rounded-lg border border-border bg-surface-0 px-3.5 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-border-strong focus:bg-surface-1"
              />
              {nameError && (
                <p className="mt-1 text-xs text-status-danger">{nameError}</p>
              )}
              <p className="mt-1 text-2xs font-medium text-text-faint">
                Lowercase letters, numbers, underscores, and hyphens only
              </p>
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Bio{' '}
                <span className="font-normal text-text-faint">— optional</span>
              </label>
              <textarea
                id="bio"
                maxLength={500}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What brings you to Open Cave?"
                className="w-full resize-none rounded-lg border border-border bg-surface-0 px-3.5 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-border-strong focus:bg-surface-1"
              />
              <p className="mt-1 text-right text-2xs font-medium text-text-faint">
                {bio.length}/500
              </p>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-status-danger">
                <ErrorMark />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !!nameError || displayName.length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-3 py-2.5 text-sm font-semibold text-text-primary transition-all duration-150 hover:bg-text-faint/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {isEdit ? 'Save changes' : 'Claim your name'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-faint">
          Display names can be changed once every 30 days.
        </p>
      </div>
    </div>
  )
}

export default function ProfileSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-col items-center justify-center bg-surface-0">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      }
    >
      <ProfileSetupForm />
    </Suspense>
  )
}
