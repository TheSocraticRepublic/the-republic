/**
 * URL validation for document re-ingestion.
 * Blocks SSRF vectors: private IP ranges, loopback, and non-HTTP(S) schemes.
 *
 * Unlike the ActivityPub validator (which requires HTTPS only), document sources
 * may legitimately use plain HTTP — government portals, legacy municipal sites,
 * etc. Both http:// and https:// are allowed.
 *
 * IPv4 private ranges blocked:
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *   169.254.0.0/16 (link-local / AWS IMDS)
 *   127.0.0.0/8 (loopback)
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
export function isValidDocumentUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Allow only http and https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

    const host = parsed.hostname

    // --- Hostname-level checks ---
    if (host === 'localhost') return false
    if (host.endsWith('.local') || host.endsWith('.internal')) return false

    // --- IPv6 checks ---
    // Defensive bracket strip (Node may handle this already)
    const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
    const hostLower = bare.toLowerCase()
    if (hostLower === '::1') return false                         // loopback
    if (hostLower === '::' || hostLower === '::0') return false  // unspecified
    if (hostLower.startsWith('fc') || hostLower.startsWith('fd')) return false  // ULA fc00::/7
    if (hostLower.startsWith('fe80')) return false               // link-local fe80::/10
    // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x) bypass the IPv4 checks below.
    // Strip the prefix and re-validate the embedded IPv4 address against all
    // private/loopback/link-local ranges. Covers ::ffff:192.168.1.1, ::ffff:10.0.0.1,
    // ::ffff:169.254.169.254, etc.
    if (/^::ffff:/i.test(hostLower)) {
      const mappedIpv4 = bare.slice(7)  // everything after "::ffff:"
      if (mappedIpv4 === '0.0.0.0') return false
      if (mappedIpv4 === '169.254.169.254') return false
      const mappedParts = mappedIpv4.split('.')
      if (mappedParts.length === 4 && mappedParts.every((p) => /^\d+$/.test(p))) {
        const [a, b] = mappedParts.map(Number)
        if (a === 0) return false                                  // 0.0.0.0/8
        if (a === 127) return false                                // 127.0.0.0/8 loopback
        if (a === 10) return false                                 // 10.0.0.0/8
        if (a === 172 && b >= 16 && b <= 31) return false         // 172.16.0.0/12
        if (a === 192 && b === 168) return false                   // 192.168.0.0/16
        if (a === 169 && b === 254) return false                   // 169.254.0.0/16 link-local
      }
      // If we can't parse it as IPv4 dotted notation, block it — unknown format is unsafe
      if (mappedParts.length !== 4 || !mappedParts.every((p) => /^\d+$/.test(p))) {
        return false
      }
    }

    // --- Non-standard IPv4 encoding checks ---
    // Reject numeric hostnames that aren't strict dotted-quad notation:
    // hex (0x7f000001), decimal (2130706433), octal (0177.0.0.1), shorthand (127.1)
    if (/^0x[0-9a-f]+$/i.test(bare)) return false                  // hex encoding
    if (/^\d+$/.test(bare)) return false                            // all-numeric (decimal)
    if (/^\d+(\.\d+){0,2}$/.test(bare)) return false               // shorthand (fewer than 4 parts)
    const dottedParts = bare.split('.')
    if (dottedParts.length === 4 && dottedParts.every((p) => /^\d+$/.test(p))) {
      if (dottedParts.some((p) => /^0\d/.test(p))) return false    // octal (leading zeros)
    }

    // --- IPv4 checks ---
    if (bare === '0.0.0.0') return false
    if (bare === '169.254.169.254') return false // AWS/GCP IMDS

    const parts = bare.split('.')
    if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number)
      if (a === 0) return false                                  // 0.0.0.0/8
      if (a === 127) return false                                // 127.0.0.0/8 loopback
      if (a === 10) return false                                 // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return false         // 172.16.0.0/12
      if (a === 192 && b === 168) return false                   // 192.168.0.0/16
      if (a === 169 && b === 254) return false                   // 169.254.0.0/16 link-local
    }

    return true
  } catch { return false }
}
