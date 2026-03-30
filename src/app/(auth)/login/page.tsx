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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to send code')
      }

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      {/* Back to home */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back
        </Link>
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="mb-1 text-xl font-bold text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            The Republic
          </h1>
          <p className="text-sm text-neutral-500">
            {step === 'email'
              ? 'Enter your email to continue'
              : `Code sent to ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur-md">
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-neutral-400"
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
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.06]"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] py-2.5 text-sm font-semibold text-neutral-100 transition-all duration-150 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="mb-1.5 block text-xs font-medium text-neutral-400"
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
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.4em] text-neutral-100 placeholder-neutral-700 outline-none transition-colors focus:border-white/20 focus:bg-white/[0.06]"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] py-2.5 text-sm font-semibold text-neutral-100 transition-all duration-150 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-40"
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
                className="w-full text-center text-xs text-neutral-600 transition-colors hover:text-neutral-400"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-neutral-700">
          No password. No tracking. Just a code.
        </p>
      </div>
    </div>
  )
}
