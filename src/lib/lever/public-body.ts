/**
 * One identity for a Lever action's recipient and jurisdiction.
 *
 * Every reader of "who is this letter to, and under which province's law"
 * goes through here: the generation route (which legal text the model gets)
 * and, from A4, the recipient notices. Nothing here ever rewrites a letter or
 * invents an address; it only reports what the stored action says and how far
 * Open Cave's directory can vouch for it.
 *
 * Client-safe (the new-action dialog imports the directory and labels).
 */

import type { PublicBody } from '@/lib/jurisdictions/types'
import { detectJurisdiction } from '@/lib/jurisdictions'
import { bcPublicBodies } from '@/lib/jurisdictions/bc/public-bodies'
import { abPublicBodies } from '@/lib/jurisdictions/ab/public-bodies'
import { onPublicBodies } from '@/lib/jurisdictions/on/public-bodies'
import { bcFoiFramework } from '@/lib/jurisdictions/bc/foi-framework'
import { abFoiFramework } from '@/lib/jurisdictions/ab/foi-framework'
import { onFoiFramework } from '@/lib/jurisdictions/on/foi-framework'

export type ProvinceId = 'bc' | 'ab' | 'on'

export const PROVINCE_IDS: readonly ProvinceId[] = ['bc', 'ab', 'on']

export function isProvinceId(value: unknown): value is ProvinceId {
  return typeof value === 'string' && (PROVINCE_IDS as readonly string[]).includes(value)
}

/**
 * The province choices the new-action dialog offers. `verified` mirrors the
 * FOI framework's own flag, so AB and ON stay labelled "not verified" for as
 * long as JURIS-2 is open, and the label moves when the flag does.
 */
export const PROVINCE_OPTIONS: readonly { id: ProvinceId; label: string; verified: boolean }[] = [
  { id: 'bc', label: 'British Columbia', verified: bcFoiFramework.verified },
  { id: 'ab', label: 'Alberta', verified: abFoiFramework.verified },
  { id: 'on', label: 'Ontario', verified: onFoiFramework.verified },
]

/**
 * A directory entry, plus the evidence fields A3 adds to `PublicBody`
 * (`sourceUrl`, `checkedOn`, `sourceQuote`). Declared here structurally so the
 * resolver can read them before and after A3 changes the shared type.
 */
export type DirectoryEntry = PublicBody & {
  sourceUrl?: string
  checkedOn?: string
  sourceQuote?: string
}

export type PublicBodyDirectory = Record<ProvinceId, readonly DirectoryEntry[]>

export const PUBLIC_BODY_DIRECTORY: PublicBodyDirectory = {
  bc: bcPublicBodies,
  ab: abPublicBodies,
  on: onPublicBodies,
}

/**
 * Legacy names that are not directory names, mapped to the directory entry
 * they mean. A fixed table: nothing is matched fuzzily. These are the BC
 * provincial bodies under their names without the "BC " prefix the directory
 * uses.
 */
export const PUBLIC_BODY_ALIASES: Readonly<Record<string, { province: ProvinceId; name: string }>> = {
  'Ministry of Forests': { province: 'bc', name: 'BC Ministry of Forests' },
  'Environmental Assessment Office': { province: 'bc', name: 'BC Environmental Assessment Office' },
  'Ministry of Environment and Climate Change Strategy': {
    province: 'bc',
    name: 'BC Ministry of Environment and Climate Change Strategy',
  },
  'Ministry of Energy, Mines and Low Carbon Innovation': {
    province: 'bc',
    name: 'BC Ministry of Energy, Mines and Low Carbon Innovation',
  },
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * The public body name stored on an action, in this precedence:
 * `publicBody` (canonical, written by actions/route.ts), then `publicBodyName`
 * (a legacy key nothing writes), then `addressee`.
 */
export function storedPublicBodyName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  return nonEmptyString(m.publicBody) ?? nonEmptyString(m.publicBodyName) ?? nonEmptyString(m.addressee)
}

/** The investigation fields jurisdiction detection reads. */
export interface InvestigationJurisdictionSource {
  concern: string
  jurisdictionName: string | null
}

/**
 * The action's jurisdiction: `metadata.jurisdiction` when it is a known
 * province, else the investigation's detected one, else null. Never a default.
 */
export function resolveActionJurisdiction(
  metadata: unknown,
  investigation: InvestigationJurisdictionSource | null | undefined
): ProvinceId | null {
  const stored =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).jurisdiction : undefined
  if (isProvinceId(stored)) return stored
  if (investigation) {
    const detected = detectJurisdiction(investigation.concern, investigation.jurisdictionName ?? undefined)
    if (isProvinceId(detected)) return detected
  }
  return null
}

/**
 * Address normalisation for comparing a directory address with the address
 * quoted from its source page: case, whitespace and punctuation are ignored,
 * and "Street"/"St", "Avenue"/"Ave" and "PO Box"/"P.O. Box"/"Box" compare equal.
 */
export function normaliseAddress(address: string): string {
  const tokens = address
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === 'p' && tokens[i + 1] === 'o' && tokens[i + 2] === 'box') {
      out.push('box')
      i += 2
    } else if (t === 'po' && tokens[i + 1] === 'box') {
      out.push('box')
      i += 1
    } else if (t === 'street') {
      out.push('st')
    } else if (t === 'avenue') {
      out.push('ave')
    } else {
      out.push(t)
    }
  }
  return out.join(' ')
}

/**
 * Checked means the entry carries all three pieces of evidence (an https
 * source URL, a checked date, a reviewed quote) and its address matches the
 * quoted address once both are normalised. Anything less is unchecked.
 */
export function isCheckedEntry(entry: DirectoryEntry): boolean {
  const sourceUrl = nonEmptyString(entry.sourceUrl)
  const checkedOn = nonEmptyString(entry.checkedOn)
  const sourceQuote = nonEmptyString(entry.sourceQuote)
  if (!sourceUrl || !checkedOn || !sourceQuote) return false
  if (!sourceUrl.startsWith('https://')) return false
  return normaliseAddress(entry.foiAddress) === normaliseAddress(sourceQuote)
}

export type RecipientResolution =
  | { status: 'checked'; province: ProvinceId; name: string; entry: DirectoryEntry }
  | { status: 'unchecked'; province: ProvinceId; name: string; entry: DirectoryEntry }
  | { status: 'other'; province: ProvinceId; name: string | null }
  | {
      status: 'unresolved'
      province: ProvinceId | null
      name: string | null
      reason: 'no-jurisdiction' | 'other-jurisdiction'
    }

function findEntry(
  directory: PublicBodyDirectory,
  province: ProvinceId,
  name: string
): DirectoryEntry | undefined {
  return directory[province].find((b) => b.name === name)
}

/** The province whose directory lists this name (directly or by alias), if any. */
function listedIn(directory: PublicBodyDirectory, name: string): { province: ProvinceId; name: string } | null {
  for (const province of PROVINCE_IDS) {
    if (findEntry(directory, province, name)) return { province, name }
  }
  const alias = PUBLIC_BODY_ALIASES[name]
  if (alias && findEntry(directory, alias.province, alias.name)) return alias
  return null
}

/**
 * Resolve an action's recipient against the directory.
 *
 * - no jurisdiction from the action or its investigation: `unresolved`;
 * - a name the directory lists only under ANOTHER province: `unresolved`
 *   (a BC body under an AB investigation is never handed a BC entry);
 * - a listed name in the action's province: `checked` or `unchecked`;
 * - any other name, or none: `other`.
 */
export function resolveRecipient(
  input: { metadata: unknown; investigation?: InvestigationJurisdictionSource | null },
  directory: PublicBodyDirectory = PUBLIC_BODY_DIRECTORY
): RecipientResolution {
  const name = storedPublicBodyName(input.metadata)
  const province = resolveActionJurisdiction(input.metadata, input.investigation)
  if (!province) return { status: 'unresolved', province: null, name, reason: 'no-jurisdiction' }
  if (!name) return { status: 'other', province, name: null }

  const listing = listedIn(directory, name)
  if (!listing) return { status: 'other', province, name }
  if (listing.province !== province) {
    return { status: 'unresolved', province, name, reason: 'other-jurisdiction' }
  }
  const entry = findEntry(directory, province, listing.name) as DirectoryEntry
  return isCheckedEntry(entry)
    ? { status: 'checked', province, name: entry.name, entry }
    : { status: 'unchecked', province, name: entry.name, entry }
}

export const CHOOSE_PROVINCE_ERROR = 'Choose the province this request goes to'

export type GenerationTarget =
  | { ok: true; jurisdictionId: string; publicBodyName: string | null }
  | { ok: false; status: 409; error: string }

/**
 * Which jurisdiction module a generation uses, and which body it names.
 *
 * FIPPA requests take both from the resolver. An unresolved recipient is
 * refused: there is no BC fallback for legal text.
 *
 * Every other action type keeps its behaviour from before A2 exactly: the
 * investigation's detected jurisdiction, else BC, and no body.
 */
export function resolveGenerationTarget(input: {
  actionType: string
  metadata: unknown
  investigation: InvestigationJurisdictionSource | null
}): GenerationTarget {
  if (input.actionType === 'fippa_request') {
    const recipient = resolveRecipient({ metadata: input.metadata, investigation: input.investigation })
    if (recipient.status === 'unresolved') {
      return { ok: false, status: 409, error: CHOOSE_PROVINCE_ERROR }
    }
    return { ok: true, jurisdictionId: recipient.province, publicBodyName: recipient.name }
  }
  const detected = input.investigation
    ? detectJurisdiction(input.investigation.concern, input.investigation.jurisdictionName ?? undefined)
    : undefined
  return { ok: true, jurisdictionId: detected ?? 'bc', publicBodyName: null }
}

/**
 * The placeholder prompt 0.6.0 tells the model to write where the public
 * body's FOI address goes. The citizen fills it in; from A4 a checked
 * directory address can be inserted in its place by an explicit edit.
 */
export const RECIPIENT_ADDRESS_PLACEHOLDER = '[Public body FOI address]'
