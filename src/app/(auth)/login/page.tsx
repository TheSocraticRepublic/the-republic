'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { safeRedirectTarget } from '@/lib/navigation/safe-redirect'

type Step = 'email' | 'code'

/** Touch screens: focusing an input on load throws up the keyboard over the
 *  page before the reader has seen it (mobile P2-11). */
const COARSE_POINTER_QUERY = '(pointer: coarse)'

function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER_QUERY).matches
}

/*
 * Error copy (plain-instructional, Jen C5). Mapped on the client from the
 * status and the server's `error` key; a server or browser string is never
 * rendered. The windows named are the real ones: verify is limited to 30 per
 * sliding 60 s, send to 60 s per IP / 5 min global, and codes to a sliding
 * hour per email (rate-limit.ts, magic-code.ts).
 */
const OFFLINE_MESSAGE = "Open Cave can't be reached. Check your connection, then try again."

function sendCodeError(status: number, serverError: unknown): string {
  if (status === 400) return "That isn't a valid email address. Check it and try again."
  if (status === 429) {
    return typeof serverError === 'string' && serverError.startsWith('Too many codes requested')
      ? 'Too many codes for this email in the last hour. Try again in an hour.'
      : 'Too many requests. Wait a few minutes, then try again.'
  }
  return "Open Cave couldn't send a code. Try again."
}

function verifyCodeError(status: number, serverError: unknown): string {
  if (status === 401) {
    return serverError === 'too_many_attempts'
      ? 'Too many wrong codes. Send a new code.'
      : "That code didn't work. Check the 8 digits, or send a new code."
  }
  if (status === 429) return 'Too many tries from this connection. Wait a minute, then try again.'
  return "Open Cave couldn't check that code. Try again."
}

/** Digits only, at most 8: separators in a pasted code are dropped before the
 *  length is applied, so " 2468 1357" keeps all eight (Jen C8). */
function normaliseCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

export default function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const instructionRef = useRef<HTMLParagraphElement>(null)

  // The one predicate both submit paths of the current step check before
  // dispatching: the step's button (an aria-disabled click guard, so the
  // button keeps focus through a failed submit) and the input's Enter
  // handler. The handlers below do not re-check it.
  const canSubmit = step === 'email' ? email.trim().length > 0 && !loading : code.length === 8 && !loading

  // Where focus goes for the current step. Fine pointers: the step's input.
  // Coarse pointers: the instruction text ("Code sent to ...", "Enter your
  // email to continue"), which raises no keyboard; a step change unmounts the
  // focused control, and leaving focus on <body> loses a screen-reader user's
  // place and sends the next Tab to "Privacy" (Jen C6, Razor RN1).
  function focusStep(current: Step) {
    if (hasCoarsePointer()) {
      instructionRef.current?.focus()
      return
    }
    const input = current === 'email' ? emailRef.current : codeRef.current
    input?.focus()
  }

  // On load, fine pointers focus the email field and coarse pointers focus
  // nothing (mobile P2-11). Every later step change, in either direction,
  // runs focusStep. Comparing with the previous step (not a first-run flag)
  // keeps a re-run of the effect on mount from counting as a change.
  const shownStep = useRef<Step>(step)
  useEffect(() => {
    if (shownStep.current === step) {
      if (!hasCoarsePointer()) emailRef.current?.focus()
      return
    }
    shownStep.current = step
    focusStep(step)
  }, [step])

  /** First send (email step) and "Send a new code" (code step), same email,
   *  same route and the server's rate limits. */
  async function handleSendCode() {
    const resend = step === 'code'
    setLoading(true)
    setError(null)
    if (resend) setCode('')

    try {
      let res: Response
      try {
        res = await fetch('/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        })
      } catch {
        setError(OFFLINE_MESSAGE)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(sendCodeError(res.status, data.error))
        return
      }

      if (resend) focusStep('code')
      else setStep('code')
    } catch (err) {
      // Not a network or HTTP failure (those return above): surfaced, never silent.
      console.error('[login] send-code:', err)
      setError("Open Cave couldn't send a code. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode() {
    setLoading(true)
    setError(null)

    try {
      let res: Response
      try {
        res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
        })
      } catch {
        setError(OFFLINE_MESSAGE)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(verifyCodeError(res.status, data.error))
        return
      }

      // A full navigation, so server components read the fresh session cookie.
      // `?redirect=` is untrusted: safeRedirectTarget returns an absolute URL
      // on this origin (the target, or /investigate), and it is assigned as-is.
      window.location.assign(
        safeRedirectTarget(new URLSearchParams(window.location.search).get('redirect'), window.location.origin)
      )
    } catch (err) {
      // Not a network or HTTP failure (those return above): surfaced, never silent.
      console.error('[login] verify-code:', err)
      setError("Open Cave couldn't check that code. Try again.")
    } finally {
      setLoading(false)
    }
  }

  // Disabled reads dimmed (the login's look is C3's); busy stays at full ink.
  const actionButtonClass = clsx(
    'flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-white/20',
    loading ? 'cursor-progress' : !canSubmit && 'cursor-not-allowed opacity-40'
  )

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4">
      {/* Cave photo background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/landing/cave-login.jpg)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/70" />

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
            className="mb-1 text-3xl font-bold text-white font-display"
          >
            Open Cave
          </h1>
          <p className="text-sm font-serif italic text-white/50">
            A Republic for the examined institution
          </p>
          <p
            ref={instructionRef}
            tabIndex={-1}
            className="mt-4 text-sm text-white/60 [overflow-wrap:anywhere] focus:outline-none"
          >
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
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSendCode()}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-status-danger">{error}</p>
              )}

              <button
                type="button"
                onClick={() => canSubmit && handleSendCode()}
                aria-disabled={!canSubmit || undefined}
                aria-busy={loading || undefined}
                className={actionButtonClass}
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
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(normaliseCode(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleVerifyCode()}
                  placeholder="00000000"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.25em] text-white placeholder-white/25 outline-none transition-colors focus:border-white/20 focus:bg-white/10"
                />
              </div>

              {error && (
                <p role="alert" className="text-xs text-status-danger">{error}</p>
              )}

              <button
                type="button"
                onClick={() => canSubmit && handleVerifyCode()}
                aria-disabled={!canSubmit || undefined}
                aria-busy={loading || undefined}
                className={actionButtonClass}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                Verify code
              </button>

              <button
                type="button"
                onClick={() => !loading && handleSendCode()}
                aria-disabled={loading || undefined}
                className="w-full text-center text-xs text-white/30 transition-colors hover:text-white/50"
              >
                Send a new code
              </button>

              <button
                type="button"
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

        <p className="mt-4 text-center text-xs font-serif italic text-white/50">
          No password. No tracking. Just a code.{' '}
          <a
            href="/privacy"
            className="underline underline-offset-2 transition-colors hover:text-white/80"
          >
            Privacy
          </a>
        </p>
      </div>
    </main>
  )
}
