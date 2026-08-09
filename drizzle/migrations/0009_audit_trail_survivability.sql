-- Migration 0009: governance / moderation / peer-review FK survivability (Batch B4)
--
-- The three user-identity FKs that cascade on account deletion, erasing
-- audit trail entries that should outlive the actor.
--
-- governance_votes.voterId:   SET NULL (orphaned votes remain counted;
--   NULLs are distinct under the unique index by default in Postgres)
-- moderation_actions.moderatorId: SET NULL (audit log survives)
-- peer_reviews.reviewerId:   SET NULL (reviews remain visible;
--   NULLs are distinct under peer_reviews_unique_idx)
--
-- Idempotent: safe to re-run.

-- 1. governance_votes.voter_id → SET NULL
ALTER TABLE governance_votes
  DROP CONSTRAINT IF EXISTS governance_votes_voter_id_users_id_fk;

ALTER TABLE governance_votes
  ALTER COLUMN voter_id DROP NOT NULL;

ALTER TABLE governance_votes
  ADD CONSTRAINT governance_votes_voter_id_users_id_fk
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE SET NULL;

-- 2. moderation_actions.moderator_id → SET NULL
ALTER TABLE moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_moderator_id_users_id_fk;

ALTER TABLE moderation_actions
  ALTER COLUMN moderator_id DROP NOT NULL;

ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_moderator_id_users_id_fk
    FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. peer_reviews.reviewer_id → SET NULL
ALTER TABLE peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_reviewer_id_users_id_fk;

ALTER TABLE peer_reviews
  ALTER COLUMN reviewer_id DROP NOT NULL;

ALTER TABLE peer_reviews
  ADD CONSTRAINT peer_reviews_reviewer_id_users_id_fk
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
