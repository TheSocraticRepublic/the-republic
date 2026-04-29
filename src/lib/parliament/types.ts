// openparliament.ca API response types

export interface OparlPagination {
  offset: number
  limit: number
  next_url: string | null
  previous_url: string | null
}

export interface OparlPaginatedResponse<T> {
  pagination: OparlPagination
  objects: T[]
}

export interface OparlPolitician {
  name: string
  url: string
  given_name?: string
  family_name?: string
  gender?: string
  email?: string
  voice?: string
  image?: string
  current_party?: {
    short_name?: { en: string }
    name?: { en: string }
  }
  current_riding?: {
    name: { en: string }
    province: string
    id?: number
  }
  memberships?: Array<{
    url: string
    start_date: string
    end_date: string | null
    party: {
      name: { en: string }
      short_name: { en: string }
    }
    riding: {
      name: { en: string }
      province: string
      id: number
    }
  }>
  other_info?: Record<string, string[]>
  links?: Array<{ url: string; note: string }>
  related?: {
    speeches_url?: string
    ballots_url?: string
    sponsored_bills_url?: string
    activity_rss_url?: string
  }
}

export interface OparlVote {
  url: string
  session: string
  number: number
  date: string
  description: { en: string; fr?: string }
  result: string
  yea_total: number
  nay_total: number
  paired_total: number
  bill_url: string | null
  context_statement?: string
  party_votes?: Array<{
    vote: string
    disagreement: number
    party: {
      name: { en: string }
      short_name: { en: string }
    }
  }>
}

export interface OparlBallot {
  vote_url: string
  politician_url: string
  politician_membership_url: string
  ballot: 'Yes' | 'No' | 'Paired' | "Didn't vote"
}

export interface OparlBill {
  url: string
  session: string
  number: string
  name: { en: string; fr?: string }
  short_title?: { en: string; fr?: string }
  introduced: string | null
  sponsor_politician_url: string | null
  home_chamber?: string
  law?: boolean | null
  private_member_bill?: boolean
  status_code?: string
  status?: { en: string }
  legisinfo_url?: string
  vote_urls?: string[]
  legisinfo_id?: number
}

// Represent API (OpenNorth) response types

export interface RepresentPostcodeResponse {
  code: string
  city: string
  province: string
  centroid: {
    type: string
    coordinates: [number, number]
  }
  boundaries_centroid: RepresentBoundary[]
  boundaries_concordance: RepresentBoundary[]
  representatives_centroid: RepresentRepresentative[]
  representatives_concordance: RepresentRepresentative[]
}

export interface RepresentBoundary {
  url: string
  name: string
  boundary_set_name: string
  external_id: string
}

export interface RepresentRepresentative {
  name: string
  district_name: string
  elected_office: string
  source_url: string
  first_name: string
  last_name: string
  party_name: string
  email: string
  url: string
  photo_url: string
  gender: string
  offices: Array<{
    fax?: string
    tel?: string
    type: string
    postal?: string
  }>
  representative_set_name: string
}

// Internal normalized types

export type BallotChoice = 'yes' | 'no' | 'paired' | 'didnt_vote'

export function normalizeBallot(raw: string): BallotChoice {
  switch (raw) {
    case 'Yes':
      return 'yes'
    case 'No':
      return 'no'
    case 'Paired':
      return 'paired'
    default:
      return 'didnt_vote'
  }
}

export function normalizeVoteResult(raw: string): 'passed' | 'defeated' | 'tie' {
  const lower = raw.toLowerCase()
  if (lower.includes('pass') || lower.includes('agreed')) return 'passed'
  if (lower.includes('tie')) return 'tie'
  return 'defeated'
}

export function extractSlug(oparlUrl: string): string {
  const parts = oparlUrl.replace(/\/$/, '').split('/')
  return parts[parts.length - 1]
}
