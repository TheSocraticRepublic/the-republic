-- Migration: CHECK constraints on investigation_outcomes.satisfaction and governance_proposals.quorum_threshold
-- Created: 2026-06-28
-- Probe-verified: investigation_outcomes and governance_proposals are EMPTY on prod (0 rows).
--                 No violating rows exist; constraints are purely additive.
--
-- Idempotent: safe to re-run.
--   - DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT is idempotent
--
-- NULL-safe: both columns are nullable; constraints use IS NULL OR ... so NULL values pass.
--
-- NOTE: This migration may be applied via MCP (bypassing the _custom_migrations runner).
-- MCP-applied migrations do NOT record into the _custom_migrations tracking table.
-- Idempotency (DROP IF EXISTS → ADD) ensures a later runner re-apply is safe.
-- See DR.md: "MCP-applied migrations must be idempotent — use IF NOT EXISTS / DROP IF EXISTS
-- guards on all DDL so a runner re-apply cannot fail on an already-applied constraint."
--
-- Rollback (if needed):
--   ALTER TABLE investigation_outcomes DROP CONSTRAINT IF EXISTS investigation_outcomes_satisfaction_check;
--   ALTER TABLE governance_proposals DROP CONSTRAINT IF EXISTS governance_proposals_quorum_threshold_check;

-- ============================================================================
-- 1. satisfaction CHECK — investigation_outcomes
-- ============================================================================

ALTER TABLE investigation_outcomes
  DROP CONSTRAINT IF EXISTS investigation_outcomes_satisfaction_check;

ALTER TABLE investigation_outcomes
  ADD CONSTRAINT investigation_outcomes_satisfaction_check
  CHECK (satisfaction IS NULL OR satisfaction BETWEEN 1 AND 5);

-- ============================================================================
-- 2. quorum_threshold CHECK — governance_proposals
-- ============================================================================

ALTER TABLE governance_proposals
  DROP CONSTRAINT IF EXISTS governance_proposals_quorum_threshold_check;

ALTER TABLE governance_proposals
  ADD CONSTRAINT governance_proposals_quorum_threshold_check
  CHECK (quorum_threshold IS NULL OR quorum_threshold BETWEEN 0 AND 1);
