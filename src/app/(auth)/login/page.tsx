'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

type Step = 'email' | 'code'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to send code')
      }

      if (data.code) setDevCode(data.code)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message =
          data.error === 'expired'
            ? 'This code has expired. Please request a new one.'
            : data.error === 'too_many_attempts'
            ? 'Too many attempts. Please request a new code.'
            : 'Invalid code. Please try again.'
        throw new Error(message)
      }

      // Redirect to app on success — server sets the auth cookie
      window.location.href = '/oracle'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-0 px-4">
      {/* Back to home */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-secondary"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back
        </Link>
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="mb-1 text-xl font-bold text-text-primary"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            The Republic
          </h1>
          <p className="text-sm text-text-muted">
            {step === 'email'
              ? 'Enter your email to continue'
              : `Code sent to ${email}`}
          </p>
          {devCode && step === 'code' && (
            <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600">
              Dev mode — your code is: <span className="font-mono font-bold tracking-wider">{devCode}</span>
            </p>
          )}
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border-strong bg-surface-1 p-6 shadow-md">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3.5 py-2.5 text-sm text-text-primary placeholder-text-faint outline-none transition-colors focus:border-border-strong focus:bg-surface-1"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-3 py-2.5 text-sm font-semibold text-text-primary transition-all duration-150 hover:bg-text-faint/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Send code
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label
                  htmlFor="code"
                  className="mb-1.5 block text-xs font-medium text-text-secondary"
                >
                  6-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-lg border border-border bg-surface-0 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.4em] text-text-primary placeholder-text-faint outline-none transition-colors focus:border-border-strong focus:bg-surface-1"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-3 py-2.5 text-sm font-semibold text-text-primary transition-all duration-150 hover:bg-text-faint/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Verify code
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
                className="w-full text-center text-xs text-text-faint transition-colors hover:text-text-muted"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-text-faint">
          No password. No tracking. Just a code.
        </p>
      </div>
    </div>
  )
}
