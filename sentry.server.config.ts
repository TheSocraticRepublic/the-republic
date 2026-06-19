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
