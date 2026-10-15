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

/*
 * Failure copy, plain-instructional like every error app-wide, shown where the
 * citizen pressed Sign out; the page stays where it is. Both lines lead with
 * the one fact a citizen at a shared computer needs (Jen C3 C5), and only the
 * request that never reached the server gets connection advice.
 */
/** The request never reached the server (fetch threw). */
export const SIGN_OUT_OFFLINE_MESSAGE =
  "You're still signed in. Open Cave can't be reached. Check your connection, then sign out again."
/** The server answered, but not with a confirmed sign-out. */
export const SIGN_OUT_REFUSED_MESSAGE =
  "You're still signed in. Open Cave couldn't sign you out. Sign out again."

/** What this tab sends. C4 adds `signed-in` (with its handoff id). */
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
  notice = null
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
    return { ok: false, message: SIGN_OUT_OFFLINE_MESSAGE }
  }

  if (!res.ok) {
    console.error('[sign-out] refused with status', res.status, res.type)
    return { ok: false, message: SIGN_OUT_REFUSED_MESSAGE }
  }
  const body: unknown = await res.json().catch(() => null)
  if (!(typeof body === 'object' && body !== null && (body as { signedOut?: unknown }).signedOut === true)) {
    console.error('[sign-out] answered without the signed-out flag')
    return { ok: false, message: SIGN_OUT_REFUSED_MESSAGE }
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
 * shows the signed-out notice (the app shell renders it, with a link that
 * signs in again in a NEW tab, so this one keeps its text) and leaves
 * everything where it is. A tab with nothing unsaved reloads as before.
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

/*
 * The signed-out notice (Jen C3 C6, C7). `elsewhere`: another tab signed out.
 * `server`: a save from this tab was answered 401. Its words, in order: the
 * lead, then a link reading NOTICE_LINK (to /login in a new tab), then
 * NOTICE_TAIL. It clears when this tab learns the session is back: a
 * successful write from this tab (`clearSignedOutNotice`) or a `signed-in`
 * message from another tab.
 */
export type SignedOutNotice = 'elsewhere' | 'server'
export const NOTICE_LEAD: Record<SignedOutNotice, string> = {
  elsewhere: "You signed out in another tab, so this tab can't save.",
  server: "You're signed out, so this tab can't save.",
}
export const NOTICE_LINK = 'Sign in again in a new tab'
export const NOTICE_TAIL = ', then save here.'

let notice: SignedOutNotice | null = null
const noticeListeners = new Set<() => void>()

function setNotice(next: SignedOutNotice | null) {
  if (notice === next) return
  notice = next
  for (const l of noticeListeners) l()
}

/** A write from this tab was answered 401: show the notice, if it isn't
 *  already showing, so the way back in is on the page. */
export function noteSignedOutByServer(): void {
  if (notice === null) setNotice('server')
}

/** A write from this tab succeeded: the session is back, the notice goes. */
export function clearSignedOutNotice(): void {
  setNotice(null)
}

function subscribeNotice(callback: () => void) {
  noticeListeners.add(callback)
  return () => {
    noticeListeners.delete(callback)
  }
}

/** Which notice to show, or null. */
export function useSignedOutNotice(): SignedOutNotice | null {
  return useSyncExternalStore(subscribeNotice, () => notice, () => null)
}

/** The type of an `oc-auth` message this tab acts on, or null. Only the type
 *  is read: C4's `signed-in` also carries its handoff id. */
function messageType(data: unknown): 'signed-out' | 'signed-in' | null {
  if (typeof data !== 'object' || data === null) return null
  const type = (data as { type?: unknown }).type
  return type === 'signed-out' || type === 'signed-in' ? type : null
}

/** Another tab signed in: this tab's session is back, so the notice goes.
 *  C4 adds its pending-concern handling here. */
export function onSignedInElsewhere(): void {
  clearSignedOutNotice()
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
    setNotice('elsewhere')
    return
  }
  window.location.reload()
}

/**
 * Listen for sign-outs (and sign-ins) in other tabs. Returns the unsubscribe
 * function (a `useEffect` cleanup). Anything on the channel that is not a
 * `signed-out` or `signed-in` message is ignored.
 */
export function listenForSignOutElsewhere(): () => void {
  const ch = authChannel()
  if (!ch) return () => {}
  const onMessage = (event: MessageEvent) => {
    const type = messageType(event.data)
    if (type === 'signed-out') onSignedOutElsewhere()
    else if (type === 'signed-in') onSignedInElsewhere()
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
