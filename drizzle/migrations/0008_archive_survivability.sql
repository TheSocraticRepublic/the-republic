-- Migration 0008: archive_records FK survivability (Batch B3)
--
-- archive_records.investigationId: DROP the FK entirely, keep NOT NULL.
--   The uuid stays as a historical pointer. The investigation id is already
--   public in the pinned IPFS/Arweave bundle and in the archive URL.
--   Dropping the FK (vs SET NULL) preserves the URL, the unique index,
--   and the upsert conflict target without nullability churn.
--
-- archive_records.userId: SET NULL on delete, make nullable.
--   Identity should go on account deletion. The public archive pages
--   already handle the null case (archivedBy ?? 'Account deleted').
--
-- Snapshot columns: jurisdiction_name, policy_area, concern_category.
--   Non-identifying descriptors copied from the investigation at archive
--   time, so orphaned records can still be labelled after the source
--   investigation is deleted. All three are already public in the bundle.
--
-- Idempotent: safe to re-run.

-- 1. Drop the investigation FK (keep the column NOT NULL + unique index)
ALTER TABLE archive_records
  DROP CONSTRAINT IF EXISTS archive_records_investigation_id_investigations_id_fk;

-- 2. Drop-and-recreate the user FK with ON DELETE SET NULL
ALTER TABLE archive_records
  DROP CONSTRAINT IF EXISTS archive_records_user_id_users_id_fk;

ALTER TABLE archive_records
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE archive_records
  ADD CONSTRAINT archive_records_user_id_users_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Add snapshot columns (idempotent via IF NOT EXISTS)
ALTER TABLE archive_records
  ADD COLUMN IF NOT EXISTS jurisdiction_name text,
  ADD COLUMN IF NOT EXISTS policy_area text,
  ADD COLUMN IF NOT EXISTS concern_category text;

-- 4. Backfill from investigations (for any existing rows)
UPDATE archive_records ar
SET
  jurisdiction_name = inv.jurisdiction_name,
  policy_area = inv.policy_area,
  concern_category = inv.concern_category
FROM investigations inv
WHERE ar.investigation_id = inv.id
  AND (ar.jurisdiction_name IS NULL OR ar.policy_area IS NULL OR ar.concern_category IS NULL);
