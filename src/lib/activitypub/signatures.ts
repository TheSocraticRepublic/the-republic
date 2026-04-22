import 'server-only'
import { importPKCS8, importSPKI } from 'jose'

/**
 * HTTP Signature implementation for ActivityPub federation.
 * Implements draft-cavage-http-signatures-12 — the version Mastodon uses.
 *
 * Mastodon expects:
 *   - Algorithm: rsa-sha256 (RSASSA-PKCS1-v1_5)
 *   - keyId: actor URL + "#main-key"
 *   - Headers for POST: (request-target) host date digest
 *   - Headers for GET: (request-target) host date
 *   - Digest: "SHA-256=" + base64(sha256(body))
 */

export interface SignedHeaders {
  Date: string
  Digest?: string
  Signature: string
  Host: string
}

/**
 * Signs an HTTP request using RSA-SHA256 per draft-cavage-http-signatures-12.
 * Returns the headers to add to the request.
 */
export async function signRequest(opts: {
  method: 'GET' | 'POST'
  url: string
  body?: string
  privateKeyPem: string
  keyId: string
}): Promise<SignedHeaders> {
  const { method, url, body, privateKeyPem, keyId } = opts

  const parsed = new URL(url)
  const host = parsed.host
  const requestTarget = `${method.toLowerCase()} ${parsed.pathname}${parsed.search}`
  const date = new Date().toUTCString()

  // Import the private key for signing
  const privateKey = await importPKCS8(privateKeyPem, 'RS256')

  const headers: Record<string, string> = { host, date }
  let headersToSign: string[]

  if (method === 'POST' && body !== undefined) {
    // Compute SHA-256 digest of body
    const bodyBytes = new TextEncoder().encode(body)
    const digestBuffer = await crypto.subtle.digest('SHA-256', bodyBytes)
    const digestBase64 = btoa(String.fromCharCode(...new Uint8Array(digestBuffer)))
    const digest = `SHA-256=${digestBase64}`
    headers['digest'] = digest
    headersToSign = ['(request-target)', 'host', 'date', 'digest']
  } else {
    headersToSign = ['(request-target)', 'host', 'date']
  }

  // Build the signing string
  const signingParts = headersToSign.map((h) => {
    if (h === '(request-target)') {
      return `(request-target): ${requestTarget}`
    }
    return `${h}: ${headers[h]}`
  })
  const signingString = signingParts.join('\n')

  // Sign using RSASSA-PKCS1-v1_5 (rsa-sha256).
  // jose's importPKCS8 returns a standard CryptoKey compatible with Web Crypto API.
  const encoder = new TextEncoder()
  const sigBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey as CryptoKey,
    encoder.encode(signingString)
  )
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))

  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${headersToSign.join(' ')}"`,
    `signature="${sigBase64}"`,
  ].join(',')

  const result: SignedHeaders = {
    Host: host,
    Date: date,
    Signature: signatureHeader,
  }

  if (headers['digest']) {
    result.Digest = headers['digest']
  }

  return result
}

/**
 * Verifies an incoming HTTP Signature from a remote actor.
 * Returns true if valid, false if invalid or unverifiable.
 *
 * The caller is responsible for fetching the actor's public key
 * from their actor document and passing it here as PEM.
 */
export async function verifyHttpSignature(opts: {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  publicKeyPem: string
}): Promise<boolean> {
  const { method, url, headers, body, publicKeyPem } = opts

  try {
    const signatureHeader = headers['signature']
    if (!signatureHeader) return false

    // Parse the Signature header
    const params = parseSignatureHeader(signatureHeader)
    if (!params) return false

    const { headers: signedHeaders, signature } = params

    const parsed = new URL(url)
    const requestTarget = `${method.toLowerCase()} ${parsed.pathname}${parsed.search}`

    // Verify digest if present in signed headers
    if (signedHeaders.includes('digest') && body !== undefined) {
      const digestHeader = headers['digest']
      if (!digestHeader || !digestHeader.startsWith('SHA-256=')) return false

      const bodyBytes = new TextEncoder().encode(body)
      const digestBuffer = await crypto.subtle.digest('SHA-256', bodyBytes)
      const expectedDigest = `SHA-256=${btoa(String.fromCharCode(...new Uint8Array(digestBuffer)))}`

      if (digestHeader !== expectedDigest) return false
    }

    // Rebuild the signing string
    const signingParts = signedHeaders.map((h: string) => {
      if (h === '(request-target)') {
        return `(request-target): ${requestTarget}`
      }
      const value = headers[h.toLowerCase()]
      if (value === undefined) return null
      return `${h}: ${value}`
    })

    if (signingParts.some((p) => p === null)) return false

    const signingString = (signingParts as string[]).join('\n')

    // Import public key and verify.
    // jose's importSPKI returns a standard CryptoKey compatible with Web Crypto API.
    const publicKey = await importSPKI(publicKeyPem, 'RS256')

    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0))
    const encoder = new TextEncoder()

    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey as CryptoKey,
      sigBytes,
      encoder.encode(signingString)
    )

    return valid
  } catch {
    return false
  }
}

// --- Internal helpers ---

interface SignatureParams {
  keyId: string
  algorithm: string
  headers: string[]
  signature: string
}

function parseSignatureHeader(header: string): SignatureParams | null {
  const result: Partial<SignatureParams> = {}

  // Match key="value" pairs, handling escaped quotes inside values
  const regex = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(header)) !== null) {
    const key = match[1]
    const value = match[2]
    if (key === 'keyId') result.keyId = value
    else if (key === 'algorithm') result.algorithm = value
    else if (key === 'headers') result.headers = value.split(' ')
    else if (key === 'signature') result.signature = value
  }

  if (!result.keyId || !result.headers || !result.signature) return null

  return result as SignatureParams
}
