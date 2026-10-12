/**
 * Mint a session cookie for a seeded QA user, signed through the app's own
 * src/lib/auth/jwt.ts with the harness's JWT_SECRET.
 *
 *   tsx --conditions=react-server scripts/qa/mint-session.ts --user a|b [--netscape <file>]
 *
 * `--conditions=react-server` resolves jwt.ts's `import 'server-only'` to its
 * empty server build, as inside Next.js. scripts/qa/harness.ts launches this
 * with `env -i` and the harness variables; see README.md.
 *
 * Output: one JSON cookie object on stdout (the shape Playwright's
 * context.addCookies() takes). With --netscape, also a curl cookie file.
 *
 * It refuses unless QA_LOCAL_DB=1, NEXT_PUBLIC_APP_URL is a loopback URL, and
 * JWT_SECRET carries the harness prefix. A production secret can never carry
 * that prefix, so this script cannot mint a production session by accident.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as url from 'node:url'
import { signJWT } from '../../src/lib/auth/jwt'
import { AUTH_COOKIE } from '../../src/lib/auth/middleware'
import { QA_JWT_SECRET_PREFIX, QA_USER_A, QA_USER_B } from './seed-local'

/** Matches verify-code's COOKIE_MAX_AGE (7 days). */
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export interface MintedCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: 'Lax'
}

function refuseUnlessHarness(): URL {
  if (process.env.QA_LOCAL_DB !== '1') throw new Error('QA_LOCAL_DB=1 is not set')
  const secret = process.env.JWT_SECRET ?? ''
  if (!secret.startsWith(QA_JWT_SECRET_PREFIX)) {
    throw new Error('JWT_SECRET is not a QA harness secret; refusing to mint a session')
  }
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'invalid:')
  if (appUrl.hostname !== '127.0.0.1' && appUrl.hostname !== 'localhost') {
    throw new Error(`NEXT_PUBLIC_APP_URL host "${appUrl.hostname}" is not loopback`)
  }
  return appUrl
}

export async function mintSessionCookie(user: 'a' | 'b'): Promise<MintedCookie> {
  const appUrl = refuseUnlessHarness()
  const identity = user === 'a' ? QA_USER_A : QA_USER_B
  const token = await signJWT({ sub: identity.id, email: identity.email })
  return {
    name: AUTH_COOKIE,
    value: token,
    domain: appUrl.hostname,
    path: '/',
    expires: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    // verify-code sets secure: true in production; the minted cookie matches.
    secure: true,
    sameSite: 'Lax',
  }
}

function toNetscape(cookie: MintedCookie): string {
  // curl's cookie-file format. The #HttpOnly_ prefix marks an httpOnly cookie.
  // The secure flag is written as FALSE because curl will not send a secure
  // cookie over plain http, even to loopback; the server never sees the flag.
  return [
    '# Netscape HTTP Cookie File (QA harness, disposable)',
    [
      `#HttpOnly_${cookie.domain}`,
      'FALSE',
      cookie.path,
      'FALSE',
      String(cookie.expires),
      cookie.name,
      cookie.value,
    ].join('\t'),
    '',
  ].join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const userArg = args[args.indexOf('--user') + 1]
  if (args.indexOf('--user') === -1 || (userArg !== 'a' && userArg !== 'b')) {
    throw new Error('usage: mint-session.ts --user a|b [--netscape <file>]')
  }
  const cookie = await mintSessionCookie(userArg)
  const netscapeIdx = args.indexOf('--netscape')
  if (netscapeIdx !== -1) {
    const out = args[netscapeIdx + 1]
    if (!out) throw new Error('--netscape needs a file path')
    fs.writeFileSync(out, toNetscape(cookie), { mode: 0o600 })
  }
  process.stdout.write(`${JSON.stringify(cookie)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`mint-session failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
