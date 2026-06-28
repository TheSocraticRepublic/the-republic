-- Migration: feedback RLS + FK cascade
-- Created: 2026-06-27
-- Probe-verified: FK constraint name = feedback_user_id_fkey (confirmed live prod query)
--                 feedback has 0 rows on prod at time of writing
--                 App role (postgres) has BYPASSRLS — FORCE RLS is a no-op for app writes
--
-- Idempotent: safe to re-run.
--   - ENABLE/FORCE ROW LEVEL SECURITY is idempotent
--   - DROP POLICY IF EXISTS before CREATE POLICY is idempotent
--   - DROP CONSTRAINT IF EXISTS before ADD CONSTRAINT is idempotent
--
-- Apply in a low-traffic window: the FK re-add takes SHARE ROW EXCLUSIVE on users
-- during constraint validation. Negligible at current feedback size, but correct hygiene.
--
-- Rollback (if needed):
--   ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE feedback NO FORCE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS feedback_select_own ON feedback;
--   DROP POLICY IF EXISTS feedback_insert_own ON feedback;
--   ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;
--   ALTER TABLE feedback ADD CONSTRAINT feedback_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
-- Note: rollback restores schema only, not data — any feedback rows deleted by CASCADE
-- between apply and rollback are gone. At 0 rows on prod, this is currently lossless.

-- ============================================================================
-- 1. ENABLE + FORCE RLS ON feedback
-- ============================================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. RLS POLICIES — scoped to auth.uid()
-- ============================================================================

-- Drop first for idempotency; CREATE POLICY has no IF NOT EXISTS in PostgreSQL
DROP POLICY IF EXISTS feedback_select_own ON feedback;
CREATE POLICY feedback_select_own ON feedback
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS feedback_insert_own ON feedback;
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 3. FK SWAP: SET NULL → CASCADE (column stays nullable)
-- ============================================================================

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;
