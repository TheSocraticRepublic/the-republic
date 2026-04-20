import { describe, it, expect } from 'vitest'
import {
  userProfiles,
  forumThreads,
  forumPosts,
  peerReviews,
  credentialEvents,
  threadStatusEnum,
  postStatusEnum,
  credentialTypeEnum,
  credentialSourceEnum,
} from '@/lib/db/schema'

describe('Forum schema — tables defined', () => {
  it('userProfiles table is defined', () => {
    expect(userProfiles).toBeDefined()
  })

  it('forumThreads table is defined', () => {
    expect(forumThreads).toBeDefined()
  })

  it('forumPosts table is defined', () => {
    expect(forumPosts).toBeDefined()
  })

  it('peerReviews table is defined', () => {
    expect(peerReviews).toBeDefined()
  })

  it('credentialEvents table is defined', () => {
    expect(credentialEvents).toBeDefined()
  })
})

describe('Forum schema — enum values', () => {
  it('threadStatusEnum has expected values', () => {
    expect(threadStatusEnum.enumValues).toEqual(['open', 'locked', 'archived'])
  })

  it('postStatusEnum has expected values', () => {
    expect(postStatusEnum.enumValues).toEqual(['visible', 'hidden', 'removed_by_author'])
  })

  it('credentialTypeEnum has all 11 values', () => {
    const expected = [
      'investigation_completed',
      'foi_filed',
      'foi_response_shared',
      'campaign_used',
      'outcome_tracked',
      'forum_contribution',
      'peer_review',
      'jurisdiction_contributed',
      'code_contributed',
      'bug_report',
      'translation',
    ]
    expect(credentialTypeEnum.enumValues).toEqual(expected)
  })

  it('credentialSourceEnum has all 6 values', () => {
    const expected = [
      'investigation',
      'peer_review',
      'forum_post',
      'campaign_material',
      'lever_action',
      'outcome',
    ]
    expect(credentialSourceEnum.enumValues).toEqual(expected)
  })
})

describe('Forum schema — column presence', () => {
  it('userProfiles has userId, displayName, bio, avatarUrl, displayNameChangedAt', () => {
    const cols = userProfiles
    expect(cols.userId).toBeDefined()
    expect(cols.displayName).toBeDefined()
    expect(cols.bio).toBeDefined()
    expect(cols.avatarUrl).toBeDefined()
    expect(cols.displayNameChangedAt).toBeDefined()
  })

  it('forumThreads has title, status, pinned, postCount, lastPostAt', () => {
    expect(forumThreads.title).toBeDefined()
    expect(forumThreads.status).toBeDefined()
    expect(forumThreads.pinned).toBeDefined()
    expect(forumThreads.postCount).toBeDefined()
    expect(forumThreads.lastPostAt).toBeDefined()
  })

  it('forumPosts has threadId, authorId, parentId, content, editedAt, status', () => {
    expect(forumPosts.threadId).toBeDefined()
    expect(forumPosts.authorId).toBeDefined()
    expect(forumPosts.parentId).toBeDefined()
    expect(forumPosts.content).toBeDefined()
    expect(forumPosts.editedAt).toBeDefined()
    expect(forumPosts.status).toBeDefined()
  })

  it('peerReviews has 5 rating dimensions', () => {
    expect(peerReviews.factualAccuracy).toBeDefined()
    expect(peerReviews.sourceQuality).toBeDefined()
    expect(peerReviews.missingContext).toBeDefined()
    expect(peerReviews.strategicEffectiveness).toBeDefined()
    expect(peerReviews.jurisdictionalAccuracy).toBeDefined()
  })

  it('credentialEvents has weight, sourceId, sourceType, description (no updatedAt)', () => {
    expect(credentialEvents.weight).toBeDefined()
    expect(credentialEvents.sourceId).toBeDefined()
    expect(credentialEvents.sourceType).toBeDefined()
    expect(credentialEvents.description).toBeDefined()
    // append-only: no updatedAt
    expect((credentialEvents as Record<string, unknown>).updatedAt).toBeUndefined()
  })
})
