/**
 * Shared utilities for print route HTML generation.
 * Used by both campaign and lever print routes.
 */

/** Escape HTML special characters to prevent XSS in rendered HTML. */
export function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Validate a URL for safe use in href attributes.
 * Only allows http: and https: schemes. Returns '#' for anything else
 * (javascript:, data:, vbscript:, or malformed URLs).
 */
export function safeHref(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return esc(url)
    }
    return '#'
  } catch {
    return '#'
  }
}

/** Render a minimal error page with escaped message. */
export function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Error</title></head>
<body style="font-family: Inter, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafaf9; color: #1c1917;">
<p>${esc(message)}</p>
</body>
</html>`
}

/** CSP header value for print pages. */
export const PRINT_CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src 'self'"
