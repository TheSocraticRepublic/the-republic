// OBS-1: this file — not `sentry.client.config.ts` — is the file Next.js
// (via Turbopack) auto-loads for client-side instrumentation. The old
// `sentry.client.config.ts` convention only worked because @sentry/nextjs's
// webpack loader auto-injected it; Turbopack does not, so client-side
// Sentry was silently dead (no errors, no breadcrumbs, no pageload
// transactions ever left the browser). Moved here per the current
// Next.js/Sentry `instrumentation-client.ts` convention:
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
import * as Sentry from '@sentry/nextjs'

// PII-1 defense-in-depth: strips everything from `?` (or `#`) onward, so any
// URL string handed to a Sentry hook never carries a query string past this
// point. The root-cause fix is moving PII (postal codes) off URLs entirely —
// see postal-code-form.tsx (POST body, not query string) — this is the
// backstop for any future route that puts a param in a URL, since the
// client SDK's default integrations capture URLs in places `beforeSend`'s
// `event.request.url` scrub never touches: fetch/xhr/navigation breadcrumbs
// (`breadcrumb.data`) and `http.client` transaction spans (`span.description`
// + `span.data`).
function stripQueryString(url: string): string {
  return url.split(/[?#]/, 1)[0]
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // Never send PII to the (US-based) monitoring service. PIPEDA: citizens'
  // emails, concern text, postal codes, and auth tokens must not leave in
  // error payloads.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      // PII-1: request.url and query_string carry raw query params — on
      // this app that includes `?postalCode=...` (parliament lookup,
      // investigate). Drop both rather than trying to allowlist/redact
      // params one at a time.
      delete event.request.url
      delete event.request.query_string
      if (event.request.headers) {
        delete event.request.headers['cookie']
        delete event.request.headers['Cookie']
        delete event.request.headers['authorization']
        delete event.request.headers['Authorization']
        delete event.request.headers['x-user-id']
        delete event.request.headers['x-user-email']
      }
    }
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
      delete event.user.username
    }
    return event
  },
  // PII-1: the default Breadcrumbs integration records every fetch/xhr as
  // `breadcrumb.data.url` and every client-side route change as
  // `breadcrumb.data.{from,to}` — none of that passes through `beforeSend`'s
  // `event.request` scrub above. Strip query strings, keep the path.
  beforeBreadcrumb(breadcrumb) {
    if (
      (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') &&
      breadcrumb.data &&
      typeof breadcrumb.data.url === 'string'
    ) {
      breadcrumb.data.url = stripQueryString(breadcrumb.data.url)
    }
    if (breadcrumb.category === 'navigation' && breadcrumb.data) {
      if (typeof breadcrumb.data.to === 'string') {
        breadcrumb.data.to = stripQueryString(breadcrumb.data.to)
      }
      if (typeof breadcrumb.data.from === 'string') {
        breadcrumb.data.from = stripQueryString(breadcrumb.data.from)
      }
    }
    return breadcrumb
  },
  // PII-1: transactions carry event.request.url too (route + query string).
  beforeSendTransaction(event) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      delete event.request.url
      delete event.request.query_string
      if (event.request.headers) {
        delete event.request.headers['cookie']
        delete event.request.headers['Cookie']
        delete event.request.headers['authorization']
        delete event.request.headers['Authorization']
        delete event.request.headers['x-user-id']
        delete event.request.headers['x-user-email']
      }
    }
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
      delete event.user.username
    }
    // PII-1: `http.client` spans (tracesSampleRate: 0.1) carry the request
    // URL — including its query string — in `span.description` and in
    // `span.data` (attribute keys vary by SDK version: `url`, `http.url`,
    // `url.full`). `event.request.url` above never covers this. Strip every
    // string field rather than allowlisting attribute names, so this stays
    // correct across SDK versions.
    if (event.spans) {
      for (const span of event.spans) {
        if (span.description) {
          span.description = stripQueryString(span.description)
        }
        if (span.data) {
          for (const key of Object.keys(span.data)) {
            const value = span.data[key]
            if (typeof value === 'string') {
              span.data[key] = stripQueryString(value)
            }
          }
        }
      }
    }
    return event
  },
})

// Required by @sentry/nextjs to instrument App Router client-side
// navigations (pageload/navigation transactions). Without this export,
// the SDK build step warns and navigation spans are not captured.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
