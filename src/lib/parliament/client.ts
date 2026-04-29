import type {
  OparlPaginatedResponse,
  OparlPolitician,
  OparlVote,
  OparlBallot,
  OparlBill,
} from './types'

const BASE_URL = 'https://api.openparliament.ca'
const USER_AGENT = 'TheRepublic/1.0 (civic-ai; thesocraticrepublic@proton.me)'
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

async function fetchWithBackoff(
  url: string,
  retries = MAX_RETRIES,
  backoff = INITIAL_BACKOFF_MS
): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'API-Version': 'v1',
      'User-Agent': USER_AGENT,
    },
  })

  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, backoff))
    return fetchWithBackoff(url, retries - 1, backoff * 2)
  }

  if (!res.ok) {
    throw new Error(`OpenParliament API ${res.status}: ${url}`)
  }

  return res
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, BASE_URL)
  url.searchParams.set('format', 'json')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

export async function fetchPaginated<T>(
  path: string,
  params?: Record<string, string>,
  maxPages = 20
): Promise<T[]> {
  const results: T[] = []
  let url: string | null = buildUrl(path, params)
  let page = 0

  while (url && page < maxPages) {
    const res = await fetchWithBackoff(url)
    const data: OparlPaginatedResponse<T> = await res.json()
    results.push(...data.objects)
    url = data.pagination.next_url
      ? `${BASE_URL}${data.pagination.next_url}&format=json`
      : null
    page++
  }

  return results
}

export async function fetchCurrentMPs(): Promise<OparlPolitician[]> {
  return fetchPaginated<OparlPolitician>('/politicians/', { limit: '100' })
}

export async function fetchMPDetail(slug: string): Promise<OparlPolitician> {
  const res = await fetchWithBackoff(buildUrl(`/politicians/${slug}/`))
  return res.json()
}

export async function fetchVotes(
  session: string,
  params?: Record<string, string>
): Promise<OparlVote[]> {
  return fetchPaginated<OparlVote>('/votes/', {
    session,
    limit: '100',
    ...params,
  })
}

export async function fetchVoteDetail(
  session: string,
  number: number
): Promise<OparlVote> {
  const res = await fetchWithBackoff(buildUrl(`/votes/${session}/${number}/`))
  return res.json()
}

export async function fetchBallotsForVote(
  session: string,
  number: number
): Promise<OparlBallot[]> {
  return fetchPaginated<OparlBallot>('/votes/ballots/', {
    vote: `/votes/${session}/${number}/`,
    limit: '400',
  })
}

export async function fetchBills(
  session: string,
  params?: Record<string, string>
): Promise<OparlBill[]> {
  return fetchPaginated<OparlBill>('/bills/', {
    session,
    limit: '100',
    ...params,
  })
}

export async function fetchBillDetail(
  session: string,
  number: string
): Promise<OparlBill> {
  const res = await fetchWithBackoff(buildUrl(`/bills/${session}/${number}/`))
  return res.json()
}

export { buildUrl, fetchWithBackoff }
