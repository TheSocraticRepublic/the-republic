import type {
  RepresentPostcodeResponse,
  RepresentRepresentative,
} from './types'

const BASE_URL = 'https://represent.opennorth.ca'

export function normalizePostalCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

export function isValidCanadianPostalCode(code: string): boolean {
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(normalizePostalCode(code))
}

export async function lookupPostalCode(
  postalCode: string
): Promise<RepresentPostcodeResponse> {
  const normalized = normalizePostalCode(postalCode)
  if (!isValidCanadianPostalCode(normalized)) {
    throw new Error(`Invalid Canadian postal code: ${postalCode}`)
  }

  // Do NOT pass `sets=federal-electoral-districts` — that filters to a *boundary*
  // set and Represent then returns boundaries with no representatives_* arrays.
  // With no sets it returns all representatives for the postcode; extractFederalMP
  // picks the House of Commons member.
  const url = `${BASE_URL}/postcodes/${normalized}/?format=json`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (res.status === 404) {
    throw new Error(`Postal code not found: ${normalized}`)
  }

  if (!res.ok) {
    throw new Error(`Represent API ${res.status}: ${url}`)
  }

  return res.json()
}

export function extractFederalMP(
  response: RepresentPostcodeResponse
): RepresentRepresentative | null {
  const allReps = [
    ...(response.representatives_centroid ?? []),
    ...(response.representatives_concordance ?? []),
  ]

  const federalMp = allReps.find(
    (r) =>
      r.representative_set_name === 'House of Commons' ||
      r.elected_office === 'MP'
  )

  return federalMp ?? null
}
