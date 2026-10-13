'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { safeRedirectTarget } from '@/lib/navigation/safe-redirect'
// Touch screens: focusing an input on load throws up the keyboard over the
// page before the reader has seen it (mobile P2-11). The shared check (B3b).
import { hasCoarsePointer } from '@/lib/ui/input-modality'

type Step = 'email' | 'code'

/*
 * Error copy (plain-instructional, Jen C5). Mapped on the client from the
 * status and the server's `error` key; a server or browser string is never
 * rendered. The windows named are the real ones: verify is limited to 30 per
 * sliding 60 s, send to 30 per sliding 60 s per IP (`scope: 'ip'`) and a
 * 5 min global cap (`scope: 'global'`), and codes to a sliding hour per email
 * (rate-limit.ts, magic-code.ts).
 */
const OFFLINE_MESSAGE = "Open Cave can't be reached. Check your connection, then try again."

function sendCodeError(status: number, serverError: unknown, scope?: unknown): string {
  if (status === 400) return "That isn't a valid email address. Check it and try again."
  if (status === 429) {
    return typeof serverError === 'string' && serverError.startsWith('Too many codes requested')
      ? 'Too many codes for this email in the last hour. Try again in an hour.'
      : scope === 'ip'
        ? 'Too many requests from this connection. Wait a minute, then try again.'
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

/** Resend outcomes (status, not errors). The skip window is 30 s, so "less
 *  than a minute" is true. */
const RESENT_MESSAGE = 'New code sent.'
const RESEND_SKIPPED_MESSAGE = 'A code was sent less than a minute ago. Use that one.'

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
  const [notice, setNotice] = useState<string | null>(null)
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
    setNotice(null)

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
        setError(sendCodeError(res.status, data.error, data.scope))
        return
      }

      if (!resend) {
        setStep('code')
        return
      }
      // The server skips the send when a usable code went out moments ago
      // (`sent: false`); say so, and keep what the citizen typed.
      const data = await res.json().catch(() => ({}))
      if (data.sent === false) {
        setNotice(RESEND_SKIPPED_MESSAGE)
        return
      }
      setCode('')
      setNotice(RESENT_MESSAGE)
      focusStep('code')
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
    setNotice(null)

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


  /*
   * The card is paper (UI plan C3, landing L6): `.light-scope` flips every
   * token inside it to ink, so the field, the button and the links read as a
   * document in the light. The action is CTAButton's primary recipe (full-ink
   * fill, surface-0 label). Unavailable is the recessed recipe, never
   * opacity, which dimmed the focus ring with it (Jen C1): text-muted on
   * surface-1, 4.91:1. Busy stays at full ink.
   */
  const actionButtonClass = clsx(
    'flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all duration-150',
    loading
      ? 'cursor-progress border-text-primary bg-text-primary text-surface-0'
      : canSubmit
        ? 'border-text-primary bg-text-primary text-surface-0 hover:opacity-90'
        : 'cursor-not-allowed border-border-strong bg-surface-1 text-text-muted'
  )

  // The secondary actions on paper: text-muted is 5.5:1 there (the old
  // white/30 measured 2.63:1, mobile P2-17).
  const quietButtonClass =
    'w-full text-center text-xs text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline'

  const fieldClass =
    'w-full rounded-lg border border-border-strong bg-surface-1 px-3.5 py-2.5 text-text-primary placeholder-text-faint outline-none transition-colors focus:border-text-muted'

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-surface-0 px-4">
      {/* Cave photo background. Positioned low so the bright crevice sits
          below the card, not behind it (landing L6). */}
      <div
        className="absolute inset-0 bg-cover"
        style={{
          backgroundImage: 'url(/landing/cave-login.jpg)',
          backgroundPosition: 'center 70%',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface-0/80 via-surface-0/40 to-surface-0/70" />

      {/* Back to home */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          Back
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand block, on its own scrim so the wordmark and tagline never
            cross the lit rock (landing L6). */}
        <div className="relative mb-8 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-16 -inset-y-12 -z-10"
            style={{
              background:
                'radial-gradient(ellipse 50% 50% at 50% 50%, color-mix(in srgb, var(--surface-0) 70%, transparent), transparent 100%)',
            }}
          />
          <h1 className="mb-1 font-display text-3xl font-bold text-text-primary">
            Open Cave
          </h1>
          {/* With its period, as on the landing hero (landing L17e). */}
          <p className="font-serif text-sm italic text-text-secondary">
            A Republic for the examined institution.
          </p>
          <p
            ref={instructionRef}
            tabIndex={-1}
            className="mt-4 text-sm text-text-secondary [overflow-wrap:anywhere] focus:outline-none"
          >
            {step === 'email'
              ? 'Enter your email to continue'
              : `Code sent to ${email}`}
          </p>
        </div>

        {/* Card: paper */}
        <div
          className="light-scope overflow-hidden rounded-xl"
          style={{
            background: 'var(--journey-paper)',
            boxShadow: '0 0 80px rgba(250,250,249,0.18), 0 24px 60px rgba(20,18,14,0.35)',
          }}
        >
          <div className="p-6">
            {step === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-text-secondary"
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
                    className={clsx(fieldClass, 'text-sm')}
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
                    className="mb-1.5 block text-xs font-medium text-text-secondary"
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
                    className="w-full rounded-lg border border-border-strong bg-surface-1 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.25em] text-text-primary placeholder-text-faint outline-none transition-colors focus:border-text-muted"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-status-danger">{error}</p>
                )}

                {/* Always mounted, so a live region announces the change. */}
                <p role="status" className={notice ? 'text-xs text-text-muted' : 'sr-only'}>
                  {notice}
                </p>

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
                  className={quietButtonClass}
                >
                  Send a new code
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setCode('')
                    setError(null)
                    setNotice(null)
                  }}
                  className={quietButtonClass}
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>

          {/* The microcopy is part of the paper, not loose on the rock, where
              it measured 1.8 to 3.2:1 (landing L6). text-muted on paper: 5.5:1. */}
          <p className="border-t border-border px-6 py-3 text-center font-serif text-xs italic text-text-muted">
            No password. No tracking. Just a code.{' '}
            <a
              href="/privacy"
              className="text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
            >
              Privacy
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
