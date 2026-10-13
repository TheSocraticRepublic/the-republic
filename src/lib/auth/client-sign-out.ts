'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * The one sign-out path in the browser (UI plan C3). The sidebar and the
 * onboarding shell both call `clientSignOut()`; nothing else posts to
 * `/api/auth/signout`.
 *
 * Order: the request first, then the broadcast, then the navigation. A tab is
 * told the citizen signed out only after the server has cleared the cookie;
 * a failed request claims nothing, sends nothing and moves nobody.
 *
 * Other tabs hear `{type: 'signed-out'}` on `BroadcastChannel('oc-auth')`
 * (`listenForSignOutElsewhere`, mounted by the app shell). The message carries
 * no user data: no id, no email, no name. C4 adds its pending-concern cleanup
 * to `clientSignOut` and to `onSignedOutElsewhere` below.
 */

export const AUTH_CHANNEL = 'oc-auth'
export const SIGN_OUT_URL = '/api/auth/signout'
/** Where a signed-out tab goes. */
export const SIGNED_OUT_DESTINATION = '/login'

/** Plain-instructional, like every error app-wide. Shown where the citizen
 *  pressed Sign out; the page stays where it is. */
export const SIGN_OUT_FAILED_MESSAGE =
  "Open Cave couldn't sign you out. Check your connection, then try again."

export type AuthMessage = { type: 'signed-out' }

export type SignOutResult = { ok: true } | { ok: false; message: string }

/*
 * One channel object per tab, shared by the sender and the listener.
 * BroadcastChannel never delivers a message to the object that posted it, so
 * the tab that signs out does not also hear its own broadcast; every other
 * tab (another object on the same name) does. `null` means the browser has no
 * BroadcastChannel (or refused to make one): sign-out still works, and other
 * tabs learn of it on their next request, which the middleware sends to
 * /login.
 */
let channel: BroadcastChannel | null | undefined

function authChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  try {
    channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(AUTH_CHANNEL) : null
  } catch (err) {
    // A browser that exposes the constructor but refuses it (a locked-down
    // context). Logged, then treated as absent: cross-tab notice is a
    // courtesy, the sign-out itself does not depend on it.
    console.warn('[sign-out] auth channel unavailable:', err instanceof Error ? err.name : 'unknown error')
    channel = null
  }
  return channel
}

/** Test seam: forget the cached channel so the next call builds a new one. */
export function resetAuthChannelForTests(): void {
  channel?.close()
  channel = undefined
}

function broadcast(message: AuthMessage): void {
  const ch = authChannel()
  if (!ch) return
  try {
    ch.postMessage(message)
  } catch (err) {
    // The sign-out has already succeeded; other tabs will find out on their
    // next request. Logged so a broken channel is visible.
    console.warn('[sign-out] broadcast failed:', err instanceof Error ? err.name : 'unknown error')
  }
}

/**
 * Sign out: POST `/api/auth/signout`, tell the other tabs, then a full
 * navigation to /login so no server-rendered page keeps the old session.
 *
 * The route answers success with a redirect. `redirect: 'manual'` keeps the
 * browser from fetching that page (it is the landing, on
 * `NEXT_PUBLIC_APP_URL`, which need not be this origin) and leaves an
 * `opaqueredirect` response: that, or any 2xx, is success. The cookie is
 * cleared by the response's Set-Cookie either way. Anything else (403 CSRF,
 * 429, 500, or no network) is a failure and nothing else happens.
 */
export async function clientSignOut(): Promise<SignOutResult> {
  let res: Response
  try {
    res = await fetch(SIGN_OUT_URL, { method: 'POST', redirect: 'manual', credentials: 'same-origin' })
  } catch (err) {
    console.error('[sign-out] request failed:', err instanceof Error ? err.name : 'unknown error')
    return { ok: false, message: SIGN_OUT_FAILED_MESSAGE }
  }

  if (res.type !== 'opaqueredirect' && !res.ok) {
    console.error('[sign-out] refused with status', res.status)
    return { ok: false, message: SIGN_OUT_FAILED_MESSAGE }
  }

  broadcast({ type: 'signed-out' })
  // A full navigation, deliberately not router.push: no server component
  // rendered for the old session survives in the client cache.
  window.location.assign(new URL(SIGNED_OUT_DESTINATION, window.location.origin).href)
  return { ok: true }
}

function isAuthMessage(data: unknown): data is AuthMessage {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'signed-out'
}

/**
 * What a tab does when another tab signed out. A reload, not a jump to /login:
 * the server decides. With the cookie gone the middleware sends the page to
 * /login with this path as `?redirect=`, so signing back in returns here.
 */
export function onSignedOutElsewhere(): void {
  window.location.reload()
}

/**
 * Listen for sign-outs in other tabs. Returns the unsubscribe function (a
 * `useEffect` cleanup). Anything on the channel that is not exactly a
 * `signed-out` message is ignored.
 */
export function listenForSignOutElsewhere(): () => void {
  const ch = authChannel()
  if (!ch) return () => {}
  const onMessage = (event: MessageEvent) => {
    if (isAuthMessage(event.data)) onSignedOutElsewhere()
  }
  ch.addEventListener('message', onMessage)
  return () => ch.removeEventListener('message', onMessage)
}

/** Mount the cross-tab listener for the life of a component. */
export function useSignOutElsewhereListener(): void {
  useEffect(() => listenForSignOutElsewhere(), [])
}

/**
 * The state a Sign out button needs: `signOut` (guarded against a second
 * press while one is in flight), `busy`, and the failure copy to show.
 */
export function useSignOut(): { signOut: () => Promise<void>; busy: boolean; error: string | null } {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const signOut = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    const result = await clientSignOut()
    if (!result.ok) {
      setError(result.message)
      setBusy(false)
      inFlight.current = false
    }
    // On success the page is navigating away; it stays busy until it goes.
  }, [])

  return { signOut, busy, error }
}
