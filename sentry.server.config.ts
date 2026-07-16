import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
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
    return event
  },
})
