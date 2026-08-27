import { isLoggable } from '@/lib/privacy/logging-policy'

/**
 * Structured log emitter gated on the privacy allowlist.
 * Fields should contain identifiers and counts only, never free text or user content.
 */
export function logEvent(event: string, fields: Record<string, string | number | boolean> = {}) {
  if (!isLoggable(event)) {
    if (process.env.NODE_ENV !== 'production') throw new Error(`Unrecognized log event: ${event}`)
    return
  }
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }))
}
