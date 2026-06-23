/**
 * trigger-generation — fire-and-forget trigger for the background briefing function.
 *
 * SERVER-ONLY. Never import this from a client component.
 *
 * Validates INTERNAL_TRIGGER_SECRET at point-of-use (NOT via global env.ts —
 * env.ts uses strict zod .parse() that throws at boot on any missing required key,
 * which would white-screen the entire app if the secret is absent).
 *
 * Returns { ok: true } when the background function accepts (202).
 * Returns { ok: false } on non-202 or network error — callers should mark the row
 * failed immediately to give the user fast feedback.
 */
import 'server-only'

export async function triggerBriefingGeneration(
  investigationId: string
): Promise<{ ok: boolean }> {
  const secret = process.env.INTERNAL_TRIGGER_SECRET
  if (!secret) {
    console.error('[trigger-generation] INTERNAL_TRIGGER_SECRET is not set — cannot trigger background function')
    return { ok: false }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[trigger-generation] NEXT_PUBLIC_APP_URL is not set')
    return { ok: false }
  }

  // NOTE: the file MUST be named `*-background.mts` for Netlify to actually run
  // it as a background function (15-min budget, async). The `config.background`
  // flag alone registers it (202 ack) but does NOT execute the handler — verified
  // the hard way in prod. The invocation path is the filename without extension.
  const triggerUrl = `${appUrl}/.netlify/functions/generate-briefing-background`

  try {
    const res = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'x-internal-secret': secret,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ investigationId }),
    })

    if (res.status !== 202) {
      console.error(
        '[trigger-generation] background function returned non-202:',
        res.status,
        'for investigation',
        investigationId
      )
      return { ok: false }
    }

    return { ok: true }
  } catch (err) {
    console.error('[trigger-generation] network error triggering background function:', err)
    return { ok: false }
  }
}
