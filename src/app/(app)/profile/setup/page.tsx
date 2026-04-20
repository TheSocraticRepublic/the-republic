'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function getSafeRedirect(param: string | null): string {
  const fallback = '/investigate'
  if (!param) return fallback
  // Must start with / and not be protocol-relative (//)
  if (!param.startsWith('/') || param.startsWith('//')) return fallback
  // Block anything containing a colon (catches javascript:, data:, etc.)
  if (param.includes(':')) return fallback
  return param
}

function ProfileSetupForm() {
  const searchParams = useSearchParams()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEdit, setIsEdit] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Validate display name live
  function validateName(name: string): string | null {
    if (name.length === 0) return null
    if (name.length < 3) return 'At least 3 characters required'
    if (name.length > 50) return 'Maximum 50 characters'
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) return 'Letters, numbers, underscores, and hyphens only'
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
    setDisplayName(value)
    setNameError(validateName(value))
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

      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong')
      }

      const redirect = getSafeRedirect(searchParams.get('redirect'))
      window.location.href = redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950">
        <Loader2 size={20} className="animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="mb-1 text-xl font-bold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            {isEdit ? 'Edit Profile' : 'Choose your identity'}
          </h1>
          <p className="text-sm text-neutral-500">
            {isEdit
              ? 'Update your public display name and bio'
              : 'Your display name is public. Your email stays private.'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name */}
            <div>
              <label
                htmlFor="displayName"
                className="mb-1.5 block text-xs font-medium text-neutral-400"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                required
                autoFocus
                maxLength={50}
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="citizen_42"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.06]"
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-400">{nameError}</p>
              )}
              <p className="mt-1 text-[11px] text-neutral-600">
                Letters, numbers, underscores, and hyphens only
              </p>
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="mb-1.5 block text-xs font-medium text-neutral-400"
              >
                Bio{' '}
                <span className="font-normal text-neutral-600">— optional</span>
              </label>
              <textarea
                id="bio"
                maxLength={500}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What brings you to The Republic?"
                className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.06]"
              />
              <p className="mt-1 text-right text-[11px] text-neutral-600">
                {bio.length}/500
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !!nameError || displayName.length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] py-2.5 text-sm font-semibold text-neutral-100 transition-all duration-150 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : null}
              {isEdit ? 'Save changes' : 'Claim your name'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-700">
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950">
          <Loader2 size={20} className="animate-spin text-neutral-500" />
        </div>
      }
    >
      <ProfileSetupForm />
    </Suspense>
  )
}
