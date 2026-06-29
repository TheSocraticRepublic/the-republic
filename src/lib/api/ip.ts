/**
 * getClientIp — extract the real client IP from a Next.js request.
 *
 * Reads x-forwarded-for and returns the FIRST address (the originating
 * client IP in a standard proxy chain). Falls back to 'unknown' when the
 * header is absent or empty.
 *
 * Used as the single source of truth for all rate-limit key construction.
 * Centralising here prevents per-call drift where some call sites took only
 * the raw header value (full proxy chain) rather than the first element.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
}
