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
  'x-forwarded-for',
  'X-Forwarded-For',
  'x-real-ip',
  'X-Real-Ip',
  'x-nf-client-connection-ip',
  'X-Nf-Client-Connection-Ip',
] as const

// Path-segment redaction rules. Each entry: if the segment before a value
// matches the pattern, the value is replaced. Structured as a table so the
// next PII-in-path route is one entry, not a rediscovery.
const PATH_REDACTIONS: { segment: string }[] = [
  { segment: 'postcodes' },
]

export function redactUrl(url: string): string {
  const [base] = url.split(/[?#]/, 1)
  let result = base
  for (const { segment } of PATH_REDACTIONS) {
    const pattern = new RegExp(`(/${segment}/)([^/]+)`, 'gi')
    result = result.replace(pattern, `$1[redacted]`)
  }
  return result
}

interface ScrubbableBreadcrumb {
  category?: string
  data?: Record<string, unknown>
}

interface ScrubbableSpan {
  description?: string
  data?: Record<string, unknown>
}

export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(breadcrumb: T): T {
  if (
    (breadcrumb.category === 'fetch' ||
      breadcrumb.category === 'xhr' ||
      breadcrumb.category === 'http') &&
    breadcrumb.data &&
    typeof breadcrumb.data.url === 'string'
  ) {
    breadcrumb.data.url = redactUrl(breadcrumb.data.url)
  }
  if (breadcrumb.category === 'navigation' && breadcrumb.data) {
    if (typeof breadcrumb.data.to === 'string') {
      breadcrumb.data.to = redactUrl(breadcrumb.data.to)
    }
    if (typeof breadcrumb.data.from === 'string') {
      breadcrumb.data.from = redactUrl(breadcrumb.data.from)
    }
  }
  return breadcrumb
}

export function scrubSpans(spans: ScrubbableSpan[]): void {
  for (const span of spans) {
    if (span.description) {
      span.description = redactUrl(span.description)
    }
    if (span.data) {
      for (const key of Object.keys(span.data)) {
        const value = span.data[key]
        if (typeof value === 'string') {
          span.data[key] = redactUrl(value)
        }
      }
    }
  }
}

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
