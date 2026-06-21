-- Migration: Feedback table for bug/suggestion channel
-- Wave 5: Scope slivers
-- Created: 2026-06-20
--
-- Safe to run in a single transaction — no ALTER TYPE statements.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE TYPE IF NOT EXISTS (via DO block).

-- ============================================================================
-- 1. CREATE feedback_type ENUM (idempotent via DO block)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
    CREATE TYPE feedback_type AS ENUM ('bug', 'suggestion');
  END IF;
END
$$;

-- ============================================================================
-- 2. CREATE feedback TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  feedback_type feedback_type NOT NULL,
  description   text        NOT NULL,
  page_context  text,
  status        text        NOT NULL DEFAULT 'new',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS feedback_user_id_idx    ON feedback (user_id);
CREATE INDEX IF NOT EXISTS feedback_type_idx       ON feedback (feedback_type);
CREATE INDEX IF NOT EXISTS feedback_status_idx     ON feedback (status);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at);
