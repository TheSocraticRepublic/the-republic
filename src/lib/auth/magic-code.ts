import 'server-only'

// In-process store for magic codes. Replace with Redis or DB in production
// once Upstash is wired in — this is sufficient for Phase 0.1.
const CODE_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes

interface MagicCode {
  code: string
  expiresAt: number
  attempts: number
}

const store = new Map<string, MagicCode>()

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Generate and store a 6-digit code for the given email.
 * Overwrites any existing code for that email.
 */
export function createMagicCode(email: string): string {
  const code = generateCode()
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + CODE_EXPIRY_MS,
    attempts: 0,
  })
  return code
}

export type VerifyResult =
  | { success: true }
  | { success: false; error: 'expired' | 'invalid' | 'too_many_attempts' }

/**
 * Verify a magic code. Deletes the code on success.
 * Allows a maximum of 5 verification attempts before lockout.
 */
export function verifyMagicCode(email: string, code: string): VerifyResult {
  const entry = store.get(email.toLowerCase())

  if (!entry) {
    return { success: false, error: 'invalid' }
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase())
    return { success: false, error: 'expired' }
  }

  if (entry.attempts >= 5) {
    return { success: false, error: 'too_many_attempts' }
  }

  if (entry.code !== code) {
    store.set(email.toLowerCase(), { ...entry, attempts: entry.attempts + 1 })
    return { success: false, error: 'invalid' }
  }

  store.delete(email.toLowerCase())
  return { success: true }
}

/** Remove a code from the store (e.g. on sign-out or after use). */
export function deleteMagicCode(email: string): void {
  store.delete(email.toLowerCase())
}
