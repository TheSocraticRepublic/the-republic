'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

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

/** Test seam: forget the cached channel, the unsaved-work registry and the
 *  notice, so each test starts from a fresh tab. */
export function resetAuthChannelForTests(): void {
  channel?.close()
  channel = undefined
  unsavedWork.clear()
  signedOutElsewhere = false
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
 * Success is the route's own answer and nothing else: a 2xx whose body is
 * `{ signedOut: true }` (Razor C3 N1). `redirect: 'manual'` turns any 3xx
 * into an unreadable `opaqueredirect`, which is NOT success: a redirect from
 * a platform rewrite or a middleware change never claims a sign-out.
 * Anything else (403 CSRF, 500, a 3xx, a body without the flag, or no
 * network) is a failure and nothing else happens.
 */
export async function clientSignOut(): Promise<SignOutResult> {
  let res: Response
  try {
    res = await fetch(SIGN_OUT_URL, { method: 'POST', redirect: 'manual', credentials: 'same-origin' })
  } catch (err) {
    console.error('[sign-out] request failed:', err instanceof Error ? err.name : 'unknown error')
    return { ok: false, message: SIGN_OUT_FAILED_MESSAGE }
  }

  if (!res.ok) {
    console.error('[sign-out] refused with status', res.status, res.type)
    return { ok: false, message: SIGN_OUT_FAILED_MESSAGE }
  }
  const body: unknown = await res.json().catch(() => null)
  if (!(typeof body === 'object' && body !== null && (body as { signedOut?: unknown }).signedOut === true)) {
    console.error('[sign-out] answered without the signed-out flag')
    return { ok: false, message: SIGN_OUT_FAILED_MESSAGE }
  }

  broadcastSignedOut()
  // A full navigation, deliberately not router.push: no server component
  // rendered for the old session survives in the client cache.
  window.location.assign(new URL(SIGNED_OUT_DESTINATION, window.location.origin).href)
  return { ok: true }
}

/**
 * Tell the other tabs this session has ended. Called by `clientSignOut` and
 * by account deletion, once the server has confirmed. Never before.
 */
export function broadcastSignedOut(): void {
  broadcast({ type: 'signed-out' })
}

/*
 * Unsaved work (Razor C3 W2). A component holding text the citizen has typed
 * and not saved registers it while it is dirty. When another tab signs out,
 * a tab with unsaved work does NOT reload (that would discard the text): it
 * shows SIGNED_OUT_ELSEWHERE_MESSAGE and leaves everything where it is. A tab
 * with nothing unsaved reloads as before.
 */
const unsavedWork = new Set<symbol>()

export function hasUnsavedWork(): boolean {
  return unsavedWork.size > 0
}

/** Register unsaved work for as long as `dirty` is true and the component is mounted. */
export function useUnsavedWork(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return
    const token = Symbol('unsaved-work')
    unsavedWork.add(token)
    return () => {
      unsavedWork.delete(token)
    }
  }, [dirty])
}

export const SIGNED_OUT_ELSEWHERE_MESSAGE =
  "You've signed out in another tab. Copy anything you want to keep, then sign in again."

let signedOutElsewhere = false
const noticeListeners = new Set<() => void>()

function subscribeNotice(callback: () => void) {
  noticeListeners.add(callback)
  return () => {
    noticeListeners.delete(callback)
  }
}

/** True once another tab has signed out while this one held unsaved work. */
export function useSignedOutElsewhereNotice(): boolean {
  return useSyncExternalStore(subscribeNotice, () => signedOutElsewhere, () => false)
}

function isAuthMessage(data: unknown): data is AuthMessage {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'signed-out'
}

/**
 * What a tab does when another tab signed out.
 * - Unsaved work: no reload. The notice shows, and the text stays where it is
 *   to be copied out (a save from here would answer 401 anyway).
 * - Nothing unsaved: a reload, not a jump to /login, so the server decides.
 *   With the cookie gone the middleware sends the page to /login with this
 *   path as `?redirect=`, so signing back in returns here.
 */
export function onSignedOutElsewhere(): void {
  if (hasUnsavedWork()) {
    signedOutElsewhere = true
    for (const l of noticeListeners) l()
    return
  }
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
