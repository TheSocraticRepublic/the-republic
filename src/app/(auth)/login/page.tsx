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

  async function handleSendCode() {
    if (!email.trim() || loading) return

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

      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    if (code.length !== 8 || loading) return

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

      window.location.href = '/investigate'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      {/* Cave photo background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/landing/cave-login.jpg)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />

      {/* Back to home */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white/80"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1
            className="mb-1 text-2xl font-bold text-white"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Open Cave
          </h1>
          <p className="text-xs font-medium uppercase tracking-widest text-white/40">
            A Republic for the examined institution
          </p>
          <p className="mt-4 text-sm text-white/60">
            {step === 'email'
              ? 'Enter your email to continue'
              : `Code sent to ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/10 bg-black/60 p-6 shadow-2xl backdrop-blur-md">
          {step === 'email' ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-white/50"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && email.trim() && handleSendCode()}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Send code
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="code"
                  className="mb-1.5 block text-xs font-medium text-white/50"
                >
                  8-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && code.length === 8 && handleVerifyCode()}
                  placeholder="00000000"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-white placeholder-white/25 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 8}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Verify code
              </button>

              <button
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
                className="w-full text-center text-xs text-white/30 transition-colors hover:text-white/50"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-white/30">
          No password. No tracking. Just a code.
        </p>
      </div>
    </div>
  )
}
