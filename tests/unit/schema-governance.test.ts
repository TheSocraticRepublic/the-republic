import { describe, it, expect } from 'vitest'
import {
  governanceProposals,
  governanceVotes,
  governanceConfig,
  proposalTypeEnum,
  proposalStatusEnum,
} from '@/lib/db/schema'

describe('Governance schema — tables defined', () => {
  it('governanceProposals table is defined', () => {
    expect(governanceProposals).toBeDefined()
  })

  it('governanceVotes table is defined', () => {
    expect(governanceVotes).toBeDefined()
  })

  it('governanceConfig table is defined', () => {
    expect(governanceConfig).toBeDefined()
  })
})

describe('Governance schema — enum values', () => {
  it('proposalTypeEnum has expected values', () => {
    expect(proposalTypeEnum.enumValues).toEqual([
      'policy',
      'feature',
      'constitutional',
      'funding',
    ])
  })

  it('proposalStatusEnum has expected values', () => {
    expect(proposalStatusEnum.enumValues).toEqual([
      'draft',
      'active',
      'passed',
      'rejected',
      'executed',
    ])
  })
})

describe('Governance schema — column presence', () => {
  it('governanceProposals has all required columns', () => {
    expect(governanceProposals.id).toBeDefined()
    expect(governanceProposals.authorId).toBeDefined()
    expect(governanceProposals.title).toBeDefined()
    expect(governanceProposals.body).toBeDefined()
    expect(governanceProposals.proposalType).toBeDefined()
    expect(governanceProposals.status).toBeDefined()
    expect(governanceProposals.votingOpens).toBeDefined()
    expect(governanceProposals.votingCloses).toBeDefined()
    expect(governanceProposals.quorumThreshold).toBeDefined()
    expect(governanceProposals.metadata).toBeDefined()
    expect(governanceProposals.createdAt).toBeDefined()
    expect(governanceProposals.updatedAt).toBeDefined()
  })

  it('governanceVotes has all required columns', () => {
    expect(governanceVotes.id).toBeDefined()
    expect(governanceVotes.proposalId).toBeDefined()
    expect(governanceVotes.voterId).toBeDefined()
    expect(governanceVotes.choice).toBeDefined()
    expect(governanceVotes.weight).toBeDefined()
    expect(governanceVotes.rawCredentialWeight).toBeDefined()
    expect(governanceVotes.votedAt).toBeDefined()
  })

  it('governanceConfig has all required columns', () => {
    expect(governanceConfig.id).toBeDefined()
    expect(governanceConfig.key).toBeDefined()
    expect(governanceConfig.value).toBeDefined()
    expect(governanceConfig.updatedBy).toBeDefined()
    expect(governanceConfig.updatedAt).toBeDefined()
  })
})
