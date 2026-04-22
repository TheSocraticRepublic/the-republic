import 'server-only'

// JSON-LD context for ActivityPub
export const AP_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
]

/**
 * Returns the configured AP domain, or throws if not set.
 * All URL builders call this — so if AP_DOMAIN is missing,
 * you get a clear error rather than silent malformed URLs.
 */
export function getApDomain(): string {
  const domain = process.env.AP_DOMAIN
  if (!domain) {
    throw new Error('AP_DOMAIN environment variable is not set')
  }
  // Strip trailing slash for consistency
  return domain.replace(/\/$/, '')
}

/**
 * Returns true if federation is configured. Use this to gate AP endpoints
 * rather than calling getApDomain() and catching.
 */
export function isFederationConfigured(): boolean {
  return Boolean(process.env.AP_DOMAIN)
}

// --- URL builders ---
// All return absolute URLs with the configured domain.

export function actorUrl(apHandle: string): string {
  return `https://${getApDomain()}/ap/users/${apHandle}`
}

export function inboxUrl(apHandle: string): string {
  return `https://${getApDomain()}/ap/users/${apHandle}/inbox`
}

export function outboxUrl(apHandle: string): string {
  return `https://${getApDomain()}/ap/users/${apHandle}/outbox`
}

export function followersUrl(apHandle: string): string {
  return `https://${getApDomain()}/ap/users/${apHandle}/followers`
}

export function threadUrl(threadId: string): string {
  return `https://${getApDomain()}/ap/threads/${threadId}`
}

export function postUrl(postId: string): string {
  return `https://${getApDomain()}/ap/posts/${postId}`
}

export function webfingerUrl(): string {
  return `https://${getApDomain()}/.well-known/webfinger`
}

export function profileWebUrl(displayName: string): string {
  return `https://${getApDomain()}/u/${displayName}`
}
