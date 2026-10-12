import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from '@/lib/env'

// Supabase Root 2021 CA — pinned for verified TLS in production.
//
// This root CA signs both connection paths:
//   - Direct endpoint:  db.<ref>.supabase.co:5432
//   - Transaction pooler: aws-1-us-east-2.pooler.supabase.com:6543
// So the same cert works regardless of which URL DATABASE_URL points at.
//
// Source: extracted live from db.gtctqrniggcbmyyrsrnk.supabase.co:5432
//   via: openssl s_client -connect ... -starttls postgres -showcerts (depth 2)
// Subject: CN=Supabase Root 2021 CA, O=Supabase Inc
// Valid:   2021-04-28 → 2031-04-26
//
// RENEWAL: When this CA expires (2031-04-26), re-fetch with:
//   openssl s_client -connect <pooler>:6543 -starttls postgres -showcerts
// and update the PEM below.
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`

// The local-only QA rule. The QA harness Postgres (127.0.0.1:55432) has no
// TLS, so TLS is switched off ONLY when QA_LOCAL_DB=1 AND the URL's host is
// 127.0.0.1 or localhost. The flag with any other host throws, in every
// NODE_ENV, before a connection is opened. Without the flag nothing changes.
//
// Host parsing mirrors postgres.js 3.4: the host postgres.js dials comes from
// the authority after the FIRST '@', and a comma there is a multi-host list.
// A multi-host list is never treated as loopback. scripts/lib/local-db-guard.ts
// carries the scripts-side copy (separate module roots, as with the CA).
const QA_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

function isLoopbackDatabaseUrl(url: string): boolean {
  const schemeEnd = url.indexOf('://')
  if (schemeEnd === -1) return false
  const authority = url.slice(schemeEnd + 3).split(/[?/]/)[0]
  const hostPart = decodeURIComponent(authority.slice(authority.indexOf('@') + 1))
  if (hostPart.includes(',')) return false
  try {
    return QA_LOOPBACK_HOSTS.has(new URL(url).hostname.toLowerCase())
  } catch {
    // Unparseable URL: not provably loopback, so the caller refuses it.
    return false
  }
}

export interface SslConfigInput {
  nodeEnv: string
  databaseUrl: string
  qaLocalDb: string | undefined
}

export function buildSslConfig({ nodeEnv, databaseUrl, qaLocalDb }: SslConfigInput) {
  if (qaLocalDb === '1') {
    if (isLoopbackDatabaseUrl(databaseUrl)) return false
    throw new Error(
      'QA_LOCAL_DB=1 is set but the DATABASE_URL host is not 127.0.0.1 or localhost; refusing to connect'
    )
  }
  if (nodeEnv === 'production') {
    // Pin the Supabase Root 2021 CA so TLS is verified without trusting the
    // OS store (which doesn't include Supabase's private PKI).
    // rejectUnauthorized: true rejects any cert not chaining to this CA.
    return { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true }
  }
  // Dev / test: relaxed. Local .env.local may point at direct endpoints or
  // local DBs with self-signed certs. Don't break the local dev loop.
  // The dev warning below is intentional — this is not a prod vulnerability.
  return { rejectUnauthorized: false }
}

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  if (!db) {
    const client = postgres(env.DATABASE_URL, {
      // Serverless: every warm Lambda holds its own pool, and Supabase's
      // session-mode pooler caps TOTAL clients (pool_size 15). max:20 per
      // instance exhausted it — EMAXCONNSESSION took down DB-heavy pages on
      // 2026-06-19. Keep this small; the real fix is pointing DATABASE_URL at
      // the :6543 transaction pooler, which multiplexes and releases per-txn.
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: buildSslConfig({
        nodeEnv: env.NODE_ENV,
        databaseUrl: env.DATABASE_URL,
        // Read directly, like isForumEnabled(): not part of the env schema.
        qaLocalDb: process.env.QA_LOCAL_DB,
      }),
    })
    db = drizzle(client, { schema })
  }
  return db
}
