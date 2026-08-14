import * as Sentry from '@sentry/nextjs'
import { scrubEventPII, scrubBreadcrumb, scrubSpans } from '@/lib/sentry-scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    return scrubEventPII(event)
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubBreadcrumb(breadcrumb)
  },
  beforeSendTransaction(event) {
    scrubEventPII(event)
    if (event.spans) {
      scrubSpans(event.spans)
    }
    return event
  },
})
