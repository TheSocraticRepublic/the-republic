/**
 * URL validation for ActivityPub federation.
 * Blocks SSRF vectors: private ranges, loopback, cloud metadata endpoints,
 * mDNS/internal hostnames, and non-HTTPS schemes.
 */
export function isValidFederationUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Must be HTTPS
    if (parsed.protocol !== 'https:') return false
    // Block private/loopback ranges
    const host = parsed.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    if (host.startsWith('10.') || host.startsWith('172.') || host.startsWith('192.168.')) return false
    if (host === '169.254.169.254') return false // AWS IMDS
    if (host.endsWith('.local') || host.endsWith('.internal')) return false
    return true
  } catch { return false }
}
