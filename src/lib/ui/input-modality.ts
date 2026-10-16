'use client'

import { useSyncExternalStore } from 'react'

/*
 * How the reader is pointing and typing, for the forms (UI plan B3b).
 *
 * The coarse-pointer test is the login page's (B3a): `(pointer: coarse)`
 * through `window.matchMedia`, with a missing `matchMedia` read as a fine
 * pointer. The functions here are that one check, plus the render-time form
 * of it a component needs to choose its copy.
 */

export const COARSE_POINTER_QUERY = '(pointer: coarse)'

/** True on a touch-first device. Read at the moment of the call, for effects
 *  (autofocus) that run once. */
export function hasCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(COARSE_POINTER_QUERY).matches
}

function subscribePointer(callback: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(COARSE_POINTER_QUERY)
  // Absent on very old Safari; the value then holds for the page's life.
  if (typeof mql.addEventListener !== 'function') return () => {}
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

/** The coarse-pointer check at render time, kept current when the primary
 *  pointer changes (a tablet docked to a keyboard and trackpad). The server
 *  has no pointer and renders the fine-pointer form. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribePointer, hasCoarsePointer, () => false)
}

/** The modifier a keyboard shortcut is written with on this platform: "Cmd"
 *  on Apple devices, "Ctrl" everywhere else. */
export function modifierKeyLabel(): 'Cmd' | 'Ctrl' {
  const nav = window.navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform) ? 'Cmd' : 'Ctrl'
}

const noSubscription = () => () => {}

/** `modifierKeyLabel` at render time. `null` on the server, which cannot know
 *  the platform: a caller renders no shortcut text until the browser has said
 *  which key it is, rather than naming the wrong one. */
export function useModifierKeyLabel(): 'Cmd' | 'Ctrl' | null {
  return useSyncExternalStore(noSubscription, modifierKeyLabel, () => null)
}
