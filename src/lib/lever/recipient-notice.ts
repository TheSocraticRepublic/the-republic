/**
 * The recipient notices (filings design §3), in one place, so the screen, the
 * print guidance page and the PDF guidance page say the same thing in the
 * same words.
 *
 * Nothing here rewrites a letter or vouches for one. The checked-address line
 * is an OCCURRENCE check and is named as one: finding the directory address
 * in a letter is never shown as a confirmation, and not finding it is said
 * plainly. (Razor N4, A3: letters written before A2 carry the old per-ministry
 * PO boxes while the same bodies now resolve `checked` at PO Box 9569.)
 *
 * Client-safe: the Lever viewer imports it to word its notices as the letter
 * is edited.
 */

import {
  isProvinceId,
  normaliseAddress,
  resolveRecipient,
  RECIPIENT_ADDRESS_PLACEHOLDER,
  type ProvinceId,
  type RecipientResolution,
} from '@/lib/lever/public-body'
import { GUIDANCE_MARKER, parseLetter, projectBlocks } from '@/lib/lever/letter-blocks'

/**
 * The resolver, from what the Lever page hands the viewer: the action's
 * metadata and its investigation's province (already resolved on the server).
 * The same precedence as resolveActionJurisdiction: a stored
 * `metadata.jurisdiction` first, then the investigation's province, never a
 * default.
 */
export function resolveRecipientForViewer(
  metadata: Record<string, unknown>,
  investigationProvince: ProvinceId | null
): RecipientResolution {
  const jurisdiction = isProvinceId(metadata.jurisdiction) ? metadata.jurisdiction : investigationProvince
  return resolveRecipient({ metadata: { ...metadata, jurisdiction: jurisdiction ?? undefined } })
}

/** Shown for every FIPPA letter, whatever the resolver says. */
export const RECIPIENT_CHECK_LINE = "Check the recipient before you send. Open Cave doesn't confirm it for you."

export const ADDRESS_NOT_FOUND_LINE = "We couldn't find that address in your letter."

export const NO_CHECKED_ADDRESS_LINE =
  'Open Cave has no checked address for this body. Find its FOI contact on its own website and confirm it before you send.'

export const WHERE_TO_SEND_TITLE = 'Where to send this'

/** The attribution's only home (R5): the guidance page, never the letter. */
export const ATTRIBUTION_LINE = 'Prepared with Open Cave, opencave.ca'

export const INSERT_ADDRESS_LABEL = 'Insert directory address'

export function checkedListingLine(body: string, address: string, checkedOn: string): string {
  return `Open Cave's directory lists ${body}'s FOI address as ${address} (checked ${checkedOn}).`
}

export function uncheckedLine(body: string, source: string | null | undefined): string {
  const from = typeof source === 'string' && source.trim() ? source.trim() : 'no recorded source'
  return `Open Cave has an unchecked address for ${body}, from ${from}. Confirm it with them before you send.`
}

export function sourceLine(sourceUrl: string): string {
  return `Source: ${sourceUrl}`
}

/**
 * Does the address occur in the letter? Both sides are normalised the same
 * way the directory's own evidence is (case, whitespace, punctuation, and the
 * Street/Avenue/PO Box variants), then compared as whole token sequences.
 */
export function addressOccursIn(letterText: string, address: string): boolean {
  const needle = normaliseAddress(address)
  if (!needle) return false
  return ` ${normaliseAddress(letterText)} `.includes(` ${needle} `)
}

/** The letter part's projection: what a citizen reads as the letter. */
export function letterPartText(content: string, letterFormat: unknown): string {
  return projectBlocks(parseLetter(content, letterFormat).letter)
}

export interface ScreenRecipientNotice {
  lines: string[]
  /** The directory address the "Insert directory address" button would write, or null for no button. */
  insertAddress: string | null
}

/**
 * The on-screen notice for a FIPPA letter (§3), outside the letter.
 *
 * - checked, address not in the letter: the listing and "We couldn't find…";
 * - checked, the letter part holds `[Public body FOI address]`, draft only:
 *   the insert button (an explicit citizen edit through PATCH);
 * - unchecked: the unchecked line, never a button;
 * - other or unresolved: no address at all.
 */
export function screenRecipientNotice(
  resolution: RecipientResolution,
  content: string,
  letterFormat: unknown,
  status: 'draft' | 'final' | 'filed'
): ScreenRecipientNotice {
  const lines = [RECIPIENT_CHECK_LINE]
  let insertAddress: string | null = null
  switch (resolution.status) {
    case 'checked': {
      const { entry } = resolution
      const letter = letterPartText(content, letterFormat)
      if (!addressOccursIn(letter, entry.foiAddress)) {
        lines.push(`${checkedListingLine(entry.name, entry.foiAddress, entry.checkedOn ?? '')} ${ADDRESS_NOT_FOUND_LINE}`)
      }
      if (status === 'draft' && letter.includes(RECIPIENT_ADDRESS_PLACEHOLDER)) {
        insertAddress = entry.foiAddress
      }
      break
    }
    case 'unchecked':
      lines.push(uncheckedLine(resolution.entry.name, resolution.entry.sourceUrl))
      break
    case 'other':
    case 'unresolved':
      lines.push(NO_CHECKED_ADDRESS_LINE)
      break
  }
  return { lines, insertAddress }
}

/**
 * The "Where to send this" block on the guidance page (print and PDF only):
 * the same four outcomes in the same words, with the source page and checked
 * date for a checked entry. The attribution line follows it separately.
 */
export function whereToSendLines(resolution: RecipientResolution, content: string, letterFormat: unknown): string[] {
  const lines = [RECIPIENT_CHECK_LINE]
  switch (resolution.status) {
    case 'checked': {
      const { entry } = resolution
      const listing = checkedListingLine(entry.name, entry.foiAddress, entry.checkedOn ?? '')
      const found = addressOccursIn(letterPartText(content, letterFormat), entry.foiAddress)
      lines.push(found ? listing : `${listing} ${ADDRESS_NOT_FOUND_LINE}`)
      if (entry.sourceUrl) lines.push(sourceLine(entry.sourceUrl))
      break
    }
    case 'unchecked':
      lines.push(uncheckedLine(resolution.entry.name, resolution.entry.sourceUrl))
      break
    case 'other':
    case 'unresolved':
      lines.push(NO_CHECKED_ADDRESS_LINE)
      break
  }
  return lines
}

/**
 * The text "Insert directory address" writes: every `[Public body FOI
 * address]` in the LETTER part replaced by the address, and nothing else
 * touched (line endings, the marker line and the guidance stay byte for
 * byte). Returns null when the letter part has no placeholder.
 *
 * The letter part is found by the same rule parseLetter splits by (§2): for a
 * recorded marker-v1 letter with exactly one marker line, the lines before
 * it; otherwise the whole text.
 */
export function insertDirectoryAddress(content: string, letterFormat: unknown, address: string): string | null {
  const lines = content.split('\n')
  let letterEnd = lines.length
  if (letterFormat === 'marker-v1') {
    const markers: number[] = []
    lines.forEach((line, i) => {
      // trimEnd also drops the "\r" of a CRLF line, as parseLetter's CRLF rule does.
      if (line.trimEnd() === GUIDANCE_MARKER) markers.push(i)
    })
    if (markers.length === 1) letterEnd = markers[0]
  }
  let replaced = false
  for (let i = 0; i < letterEnd; i++) {
    if (lines[i].includes(RECIPIENT_ADDRESS_PLACEHOLDER)) {
      lines[i] = lines[i].split(RECIPIENT_ADDRESS_PLACEHOLDER).join(address)
      replaced = true
    }
  }
  return replaced ? lines.join('\n') : null
}
