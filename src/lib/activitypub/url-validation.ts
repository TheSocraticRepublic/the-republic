/**
 * URL validation for ActivityPub federation.
 * Blocks SSRF vectors: private ranges, loopback, cloud metadata endpoints,
 * mDNS/internal hostnames, and non-HTTPS schemes.
 *
 * IPv4 private ranges blocked:
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *   169.254.0.0/16 (link-local / AWS IMDS)
 *   0.0.0.0
 *
 * IPv6 private ranges blocked:
 *   ::1 (loopback), ::0 / [::] (unspecified)
 *   ::ffff:127.x.x.x (IPv4-mapped loopback)
 *   fc00::/7 (ULA — includes fd00::/8)
 *   fe80::/10 (link-local)
 *
 * Hostname patterns blocked:
 *   localhost, *.local, *.internal
 */
export function isValidFederationUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false

    const host = parsed.hostname

    // --- Hostname-level checks ---
    if (host === 'localhost') return false
    if (host.endsWith('.local') || host.endsWith('.internal')) return false

    // --- IPv6 checks (hostname is bracket-stripped by URL parser) ---
    // URL parser strips brackets: "[::1]" -> "::1"
    const hostLower = host.toLowerCase()
    if (hostLower === '::1') return false                        // loopback
    if (hostLower === '::' || hostLower === '::0') return false // unspecified
    if (hostLower.startsWith('fc') || hostLower.startsWith('fd')) return false  // ULA fc00::/7
    if (hostLower.startsWith('fe80')) return false              // link-local fe80::/10
    // IPv4-mapped loopback: ::ffff:127.x.x.x
    if (/^::ffff:127\./i.test(host)) return false

    // --- IPv4 checks ---
    if (host === '0.0.0.0') return false
    if (host === '127.0.0.1') return false
    if (host === '169.254.169.254') return false // AWS/GCP IMDS

    const parts = host.split('.')
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number)
      if (a === 10) return false                   // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false  // 172.16.0.0/12
      if (a === 192 && b === 168) return false     // 192.168.0.0/16
      if (a === 169 && b === 254) return false     // 169.254.0.0/16 link-local
    }

    return true
  } catch { return false }
}
