import { describe, it, expect } from 'vitest'
import { generateActorKeyPair } from '@/lib/activitypub/keys'
import { signRequest, verifyHttpSignature } from '@/lib/activitypub/signatures'

// Helpers — jose and Web Crypto are available in Node 18+

describe('generateActorKeyPair', () => {
  it('produces a key pair with PEM-encoded keys', async () => {
    const pair = await generateActorKeyPair()
    expect(pair.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/)
    expect(pair.privateKeyPem).toMatch(/-----BEGIN PRIVATE KEY-----/)
  })

  it('produces distinct public and private keys', async () => {
    const pair = await generateActorKeyPair()
    expect(pair.publicKeyPem).not.toBe(pair.privateKeyPem)
  })

  it('generates fresh keys on each call', async () => {
    const pair1 = await generateActorKeyPair()
    const pair2 = await generateActorKeyPair()
    expect(pair1.publicKeyPem).not.toBe(pair2.publicKeyPem)
  })
}, 30000)

describe('signRequest + verifyHttpSignature', () => {
  it('generates a verifiable signature for a POST request', async () => {
    const pair = await generateActorKeyPair()

    const url = 'https://mastodon.social/inbox'
    const body = JSON.stringify({ type: 'Create', id: 'https://republic.example.com/ap/posts/1' })
    const keyId = 'https://republic.example.com/ap/users/alice#main-key'

    const signedHeaders = await signRequest({
      method: 'POST',
      url,
      body,
      privateKeyPem: pair.privateKeyPem,
      keyId,
    })

    expect(signedHeaders.Signature).toMatch(/keyId=/)
    expect(signedHeaders.Signature).toMatch(/algorithm="rsa-sha256"/)
    expect(signedHeaders.Signature).toMatch(/headers=/)
    expect(signedHeaders.Signature).toMatch(/signature=/)
    expect(signedHeaders.Digest).toMatch(/^SHA-256=/)

    const valid = await verifyHttpSignature({
      method: 'POST',
      url,
      headers: {
        host: new URL(url).host,
        date: signedHeaders.Date,
        digest: signedHeaders.Digest!,
        signature: signedHeaders.Signature,
      },
      body,
      publicKeyPem: pair.publicKeyPem,
    })

    expect(valid).toBe(true)
  }, 30000)

  it('generates a verifiable signature for a GET request (no digest)', async () => {
    const pair = await generateActorKeyPair()

    const url = 'https://mastodon.social/ap/users/alice'
    const keyId = 'https://republic.example.com/ap/users/alice#main-key'

    const signedHeaders = await signRequest({
      method: 'GET',
      url,
      privateKeyPem: pair.privateKeyPem,
      keyId,
    })

    expect(signedHeaders.Digest).toBeUndefined()
    expect(signedHeaders.Signature).toMatch(/algorithm="rsa-sha256"/)

    const valid = await verifyHttpSignature({
      method: 'GET',
      url,
      headers: {
        host: new URL(url).host,
        date: signedHeaders.Date,
        signature: signedHeaders.Signature,
      },
      publicKeyPem: pair.publicKeyPem,
    })

    expect(valid).toBe(true)
  }, 30000)

  it('rejects a tampered signature', async () => {
    const pair = await generateActorKeyPair()

    const url = 'https://mastodon.social/inbox'
    const body = JSON.stringify({ type: 'Create' })
    const keyId = 'https://republic.example.com/ap/users/alice#main-key'

    const signedHeaders = await signRequest({
      method: 'POST',
      url,
      body,
      privateKeyPem: pair.privateKeyPem,
      keyId,
    })

    // Tamper: change the date in the headers (signing string will differ)
    const valid = await verifyHttpSignature({
      method: 'POST',
      url,
      headers: {
        host: new URL(url).host,
        date: 'Mon, 01 Jan 2024 00:00:00 GMT', // wrong date
        digest: signedHeaders.Digest!,
        signature: signedHeaders.Signature,
      },
      body,
      publicKeyPem: pair.publicKeyPem,
    })

    expect(valid).toBe(false)
  }, 30000)

  it('rejects a tampered body (digest mismatch)', async () => {
    const pair = await generateActorKeyPair()

    const url = 'https://mastodon.social/inbox'
    const body = JSON.stringify({ type: 'Create' })
    const keyId = 'https://republic.example.com/ap/users/alice#main-key'

    const signedHeaders = await signRequest({
      method: 'POST',
      url,
      body,
      privateKeyPem: pair.privateKeyPem,
      keyId,
    })

    const valid = await verifyHttpSignature({
      method: 'POST',
      url,
      headers: {
        host: new URL(url).host,
        date: signedHeaders.Date,
        digest: signedHeaders.Digest!,
        signature: signedHeaders.Signature,
      },
      body: JSON.stringify({ type: 'Create', injected: 'malicious' }), // tampered body
      publicKeyPem: pair.publicKeyPem,
    })

    expect(valid).toBe(false)
  }, 30000)

  it('rejects when signature header is missing', async () => {
    const pair = await generateActorKeyPair()

    const valid = await verifyHttpSignature({
      method: 'POST',
      url: 'https://mastodon.social/inbox',
      headers: { host: 'mastodon.social', date: new Date().toUTCString() },
      body: '{}',
      publicKeyPem: pair.publicKeyPem,
    })

    expect(valid).toBe(false)
  }, 30000)
})
