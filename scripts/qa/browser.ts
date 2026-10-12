/**
 * Browser helpers for tests that drive the QA harness. No side effects on
 * import: safe for any later batch's browser test to import.
 */

import type { BrowserContext } from 'playwright'

/**
 * No browser on the harness may reach /api/auth/send-code: it would call
 * Resend with the dummy key and the synthetic address. Install this on the
 * CONTEXT, before any page opens, so it covers every page and popup in it.
 * Returns a live counter of the requests it answered.
 */
export async function interceptSendCode(context: BrowserContext): Promise<{ count: number }> {
  const counter = { count: 0 }
  await context.route('**/api/auth/send-code', async (route) => {
    counter.count++
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  return counter
}
