/**
 * getClientIp — extract the real client IP from a Next.js request.
 *
 * SEC-1: every one of our API routes runs as a Netlify serverless route
 * handler. On that surface the trusted source of the real client IP is
 * `x-nf-client-connection-ip` — Netlify sets it from the actual TCP
 * connection, so a client cannot forge the value the handler sees.
 *
 * `x-forwarded-for` is NOT trusted on Netlify: the FIRST hop is
 * client-controllable (a request can arrive with an arbitrary XFF value
 * already attached), so blindly taking `split(',')[0]` — this function's
 * previous behaviour — was a spoofable rate-limit bypass: any caller could
 * set `X-Forwarded-For: 1.2.3.4` and get bucketed under an IP they chose.
 * When we do fall back to XFF, we take the LAST hop, which is the one
 * Netlify's edge appended and the client cannot control.
 *
 * Precedence: x-nf-client-connection-ip -> x-real-ip -> last x-forwarded-for hop.
 *
 * If none of these headers are present — rare, but the header can be
 * absent on edge/middleware and empirically, occasionally, in route
 * handlers too — we do NOT fall back to a shared constant like 'unknown'.
 * A shared fallback would put every such caller into the SAME rate-limit
 * bucket, turning "header missing" into a self-inflicted denial of service
 * for every other caller who happens to share it (one bad/misbehaving
 * client with no IP headers could exhaust the bucket for everyone else in
 * the same situation). Instead we mint a fresh, per-request-unique
 * identifier so each such request gets its own isolated bucket — no shared
 * blast radius. The tradeoff: that single request isn't meaningfully
 * IP-rate-limited (there's no trustworthy IP to key on), which is
 * acceptable for a rare fallback path but is why call sites that need a
 * hard backstop (e.g. auth/send-code) also carry a global, IP-independent
 * ceiling — see `checkGlobalSendCodeLimit` in `lib/rate-limit.ts`.
 *
 * Used as the single source of truth for all rate-limit key construction.
 * Centralising here prevents per-call drift where some call sites took only
 * the raw header value (full proxy chain) rather than validating precedence.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const nfConnectionIp = req.headers.get('x-nf-client-connection-ip')?.trim()
  if (nfConnectionIp) return nfConnectionIp

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const hops = forwardedFor
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean)
    const lastHop = hops[hops.length - 1]
    if (lastHop) return lastHop
  }

  // No trustworthy IP header present. Per-request-unique, never a shared
  // constant, so a missing header can't bucket unrelated callers together.
  return `no-ip:${crypto.randomUUID()}`
}
