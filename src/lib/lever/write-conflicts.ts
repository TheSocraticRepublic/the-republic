/**
 * The reasons PATCH /api/lever/actions/[id] answers 409 with (filings design
 * §4, plus A5's "confirm-no-notes"), shared by the route that sends them and
 * the viewer that reads them, so the two can't drift. Client-safe.
 */

export const NOT_A_DRAFT = 'This letter is no longer a draft'
export const CONTENT_CHANGED = 'This letter changed since you opened it'
export const STATUS_CHANGED = "This letter's status changed since you opened it. Reload to see it."
export const UNCLEAN_SPLIT = "Remove the notes that aren't part of your request before you finalise."

/*
 * A5 (Lee, 2026-10-12): a marker-v1 letter whose "=== NOT PART OF YOUR
 * REQUEST ===" line is missing is finalised only after the citizen confirms
 * they've removed everything that isn't part of the request. The fact and the
 * action are the viewer's confirmation, sentence by sentence; together they
 * are the 409's text.
 */
export const CONFIRM_NO_NOTES_FACT = 'This letter doesn\'t have the "Not part of your request" line.'
export const CONFIRM_NO_NOTES_ACTION = "Check you've removed everything that isn't part of your request, then finalise."
export const CONFIRM_NO_NOTES = `${CONFIRM_NO_NOTES_FACT} ${CONFIRM_NO_NOTES_ACTION}`

export type WriteConflict = 'not-a-draft' | 'content-changed' | 'status-changed' | 'unclean-split' | 'confirm-no-notes'

/** Which §4 reason a 409 body's `error` is, or null for any other text. */
export function conflictReason(error: unknown): WriteConflict | null {
  switch (error) {
    case NOT_A_DRAFT:
      return 'not-a-draft'
    case CONTENT_CHANGED:
      return 'content-changed'
    case STATUS_CHANGED:
      return 'status-changed'
    case UNCLEAN_SPLIT:
      return 'unclean-split'
    case CONFIRM_NO_NOTES:
      return 'confirm-no-notes'
    default:
      return null
  }
}

/** The editor's own line when a save loses to another write (§4, "Generate, then the citizen edits during streaming"). */
export const EDIT_CONFLICT_MESSAGE =
  'This letter changed while you were editing. Your text is still here; copy it, then reload.'

export const EDIT_NOT_A_DRAFT_MESSAGE =
  "This letter is no longer a draft, so it can't be changed. Your text is still here; copy it, then reload."

export const STALE_VIEW_MESSAGE = 'This letter changed since you opened it. Reload to see it.'

export const NEWER_VERSION_MESSAGE = 'A newer version was saved. Showing that one.'
