import * as Sentry from '@sentry/nextjs'
import { scrubEventPII } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // Never send PII to the (US-based) monitoring service. PIPEDA: citizens'
  // emails, concern text, postal codes, and auth tokens must not leave in
  // error payloads.
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubEventPII(event)
  },
  // PII-1: transactions carry event.request.url too (route + query string).
  beforeSendTransaction(event) {
    return scrubEventPII(event)
  },
})
