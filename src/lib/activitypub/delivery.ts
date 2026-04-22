import 'server-only'
import { signRequest } from './signatures'
import { actorUrl } from './context'
import { isValidFederationUrl } from './url-validation'

const DELIVERY_TIMEOUT_MS = 8000

/**
 * Delivers an AP activity to a remote inbox via signed HTTP POST.
 * Uses rsa-sha256 HTTP Signatures as expected by Mastodon.
 *
 * Returns true on success (2xx), false on failure.
 * All errors are caught and logged — callers should fire-and-forget.
 */
export async function deliverActivity(
  activity: unknown,
  targetInbox: string,
  privateKeyPem: string,
  keyId: string
): Promise<boolean> {
  if (!isValidFederationUrl(targetInbox)) {
    console.error('[AP delivery] Blocked delivery to invalid/private URL:', targetInbox)
    return false
  }

  const body = JSON.stringify(activity)

  let signedHeaders: {
    Date: string
    Digest?: string
    Signature: string
    Host: string
  }

  try {
    signedHeaders = await signRequest({
      method: 'POST',
      url: targetInbox,
      body,
      privateKeyPem,
      keyId,
    })
  } catch (err) {
    console.error('[AP delivery] Failed to sign request for', targetInbox, err)
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/activity+json',
      Accept: 'application/activity+json',
      Date: signedHeaders.Date,
      Host: signedHeaders.Host,
      Signature: signedHeaders.Signature,
    }

    if (signedHeaders.Digest) {
      headers['Digest'] = signedHeaders.Digest
    }

    const response = await fetch(targetInbox, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(
        `[AP delivery] Remote inbox ${targetInbox} returned ${response.status}`
      )
      return false
    }

    return true
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      console.error(`[AP delivery] Timeout delivering to ${targetInbox}`)
    } else {
      console.error(`[AP delivery] Failed to deliver to ${targetInbox}`, err)
    }
    return false
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Builds the keyId for an actor — the actor URL + "#main-key".
 * Convenience wrapper used by delivery callers.
 */
export function buildKeyId(apHandle: string): string {
  return `${actorUrl(apHandle)}#main-key`
}
