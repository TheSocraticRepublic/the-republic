-- Migration: Investigation status state machine + resilience columns
-- Wave 4: Investigation Pipeline Resilience
-- Created: 2026-06-20
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- in PostgreSQL. This migration uses separate statements without BEGIN/COMMIT.
-- When applied manually, run each ALTER TYPE statement outside a transaction,
-- or use a tool that supports non-transactional DDL (e.g. psql with \set AUTOCOMMIT on).
-- Supabase Dashboard SQL editor runs each statement in autocommit mode — safe.
--
-- Apply order:
--   1. Add new enum values to investigation_status (non-transactional DDL)
--   2. Add new columns to investigations table (safe in a transaction)
--   3. Reclassify existing rows (safe, idempotent)

-- ============================================================================
-- 1. ADD NEW ENUM VALUES (non-transactional — run outside BEGIN/COMMIT)
-- ============================================================================

-- These ADD VALUE statements must be run outside a transaction block.
-- They are idempotent: Postgres will error if the value already exists,
-- so check before re-running:
--   SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
--   WHERE pg_type.typname = 'investigation_status';

ALTER TYPE investigation_status ADD VALUE IF NOT EXISTS 'generating';
ALTER TYPE investigation_status ADD VALUE IF NOT EXISTS 'complete';
ALTER TYPE investigation_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE investigation_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ============================================================================
-- 2. ADD NEW COLUMNS (safe in a transaction; run after the enum values commit)
-- ============================================================================

-- failure_reason: stores the error message or timeout reason for failed/cancelled rows
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS failure_reason text;

-- briefing_completed_at already exists in the schema. Confirm with:
--   \d investigations
-- If it does not exist in your DB (older schema), uncomment:
-- ALTER TABLE investigations ADD COLUMN IF NOT EXISTS briefing_completed_at timestamp;

-- ============================================================================
-- 3. RECLASSIFY EXISTING ROWS (safe, idempotent)
-- ============================================================================

-- Rows with a completed briefing → complete
UPDATE investigations
   SET status = 'complete'
 WHERE status = 'active'
   AND briefing_text IS NOT NULL;

-- Rows that are still 'active' with no briefing text are zombies (stream never
-- finished or never started). Mark them as failed so users can retry.
-- Preserves the original concern text and all metadata — nothing is deleted.
UPDATE investigations
   SET status    = 'failed',
       failure_reason = 'Generation did not complete (pre-migration zombie)'
 WHERE status = 'active'
   AND briefing_text IS NULL;

-- 'archived' rows are left as-is — they represent intentionally archived
-- investigations and do not need reclassification.
