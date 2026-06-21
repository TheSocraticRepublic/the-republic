'use client'

/**
 * Renders a date in the user's browser-local timezone.
 *
 * The server passes the stored UTC timestamp as an ISO string; the client
 * formats it using Intl.DateTimeFormat with NO timeZone override so the
 * browser's own offset is applied. This avoids the "tomorrow" glitch for
 * evening-PDT users that appeared when the server forced timeZone:'UTC'.
 *
 * Hydration: the server renders a stable UTC fallback (suppressHydrationWarning
 * on the <time> element) so React's hydration check doesn't fire a mismatch
 * warning when the client re-renders with the local date.
 */
export function LocalDate({ iso }: { iso: string }) {
  const date = new Date(iso)

  const formatted = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)

  return (
    // suppressHydrationWarning: server renders UTC fallback, client
    // re-renders in browser-local tz — the mismatch is intentional.
    <time dateTime={iso} suppressHydrationWarning>
      {formatted}
    </time>
  )
}
