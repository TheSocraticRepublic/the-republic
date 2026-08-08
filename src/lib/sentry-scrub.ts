/**
 * Shared Sentry PII scrub — the single source for the request/user strip
 * applied by beforeSend AND beforeSendTransaction in all three runtime
 * configs (instrumentation-client.ts, sentry.server.config.ts,
 * sentry.edge.config.ts). Adding a sensitive header here covers every
 * runtime in one edit; before this module the same ~25 lines were
 * copy-pasted six times across the three files.
 *
 * Never send PII to the (US-based) monitoring service. PIPEDA: citizens'
 * emails, concern text, postal codes, and auth tokens must not leave in
 * error payloads.
 */

// Structural supertype of Sentry's ErrorEvent/TransactionEvent — fields are
// `unknown` so the generic constraint accepts every SDK event shape (User's
// `ip_address` is `string | null`, request is the SDK's Request type, etc.).
interface ScrubbableEvent {
  request?: {
    data?: unknown
    cookies?: unknown
    // PII-1: request.url and query_string carry raw query params — on
    // this app that includes `?postalCode=...` (parliament lookup,
    // investigate). Drop both rather than trying to allowlist/redact
    // params one at a time.
    url?: unknown
    query_string?: unknown
    headers?: { [key: string]: unknown }
  }
  user?: {
    email?: unknown
    ip_address?: unknown
    username?: unknown
  }
}

const SENSITIVE_HEADERS = [
  'cookie',
  'Cookie',
  'authorization',
  'Authorization',
  'x-user-id',
  'x-user-email',
] as const

export function scrubEventPII<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.url
    delete event.request.query_string
    if (event.request.headers) {
      for (const header of SENSITIVE_HEADERS) {
        delete event.request.headers[header]
      }
    }
  }
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
    delete event.user.username
  }
  return event
}
