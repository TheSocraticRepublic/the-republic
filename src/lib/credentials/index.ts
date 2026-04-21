import { credentialTypeEnum } from '@/lib/db/schema'

export type CredentialType = (typeof credentialTypeEnum.enumValues)[number]

export const CREDENTIAL_WEIGHTS: Record<CredentialType, number> = {
  investigation_completed: 3,
  foi_filed: 5,
  foi_response_shared: 5,
  campaign_used: 4,
  outcome_tracked: 5,
  forum_contribution: 1,
  peer_review: 2,
  jurisdiction_contributed: 5,
  code_contributed: 3,
  bug_report: 1,
  translation: 2,
}

export const CREDENTIAL_LABELS: Record<CredentialType, string> = {
  investigation_completed: 'Investigations completed',
  foi_filed: 'FOI requests filed',
  foi_response_shared: 'FOI responses shared',
  campaign_used: 'Campaign materials used',
  outcome_tracked: 'Outcomes tracked',
  forum_contribution: 'Forum contributions',
  peer_review: 'Peer reviews',
  jurisdiction_contributed: 'Jurisdiction modules',
  code_contributed: 'Code contributions',
  bug_report: 'Bug reports',
  translation: 'Translations',
}

export const DECAY_GRACE_DAYS = 90
export const DECAY_FLOOR = 0.5
export const DECAY_FULL_DAYS = 180

export function computeDecayMultiplier(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 0
  const daysSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= DECAY_GRACE_DAYS) return 1.0
  const decayProgress = Math.min(1, (daysSince - DECAY_GRACE_DAYS) / (DECAY_FULL_DAYS - DECAY_GRACE_DAYS))
  return Math.max(DECAY_FLOOR, 1.0 - decayProgress * (1 - DECAY_FLOOR))
}

export function computeEffectiveWeight(totalWeight: number, lastActivityAt: Date | null): number {
  return Math.round(totalWeight * computeDecayMultiplier(lastActivityAt))
}

export interface CredentialBreakdown {
  type: CredentialType
  label: string
  count: number
  rawWeight: number
}

export interface CredentialSummary {
  rawTotal: number
  effectiveTotal: number
  decayMultiplier: number
  lastActivityAt: Date | null
  breakdown: CredentialBreakdown[]
}
