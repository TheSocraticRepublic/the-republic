export interface WebfingerResponse {
  subject: string
  aliases: string[]
  links: Array<{
    rel: string
    type: string
    href: string
  }>
}

/**
 * Parses a WebFinger resource parameter (e.g. "acct:alice@republic.example.com").
 * Returns the local part (handle) if the domain matches AP_DOMAIN, otherwise null.
 */
export function parseWebfingerResource(
  resource: string | null,
  apDomain: string
): string | null {
  if (!resource) return null

  // Must be an acct: URI
  if (!resource.startsWith('acct:')) return null

  const acct = resource.slice('acct:'.length)
  const atIndex = acct.lastIndexOf('@')
  if (atIndex === -1) return null

  const handle = acct.slice(0, atIndex)
  const domain = acct.slice(atIndex + 1)

  if (!handle || !domain) return null

  // Domain must match — case-insensitive
  if (domain.toLowerCase() !== apDomain.toLowerCase()) return null

  return handle
}

/**
 * Builds the JRD (JSON Resource Descriptor) response body for a WebFinger lookup.
 * Content-Type: application/jrd+json
 */
export function buildWebfingerResponse(
  handle: string,
  apDomain: string
): WebfingerResponse {
  const subject = `acct:${handle}@${apDomain}`
  const actor = `https://${apDomain}/ap/users/${handle}`

  return {
    subject,
    aliases: [actor],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actor,
      },
    ],
  }
}
