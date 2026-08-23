-- 0012: Generation nonce, gadfly turn unique, contradictions nullable
-- BUG-F15/F28 + DATA-F3 + BUG-F17
-- Idempotent: safe to re-run.
--
-- DATA-F3 note: gadfly_turns.turn_id FK has onDelete:cascade to insight_markers.
-- Displaced turns are RENUMBERED, not deleted, to preserve citizen dialogue and markers.

-- 1. generationNonce column (BUG-F15/F28)
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS generation_nonce uuid;

-- 2. turnIndex unique constraint (DATA-F3)
-- Renumber duplicate (session_id, turn_index) rows instead of deleting.
-- Each displaced turn gets a unique index past the session's current max.
WITH ranked AS (
  SELECT id, session_id, turn_index,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, turn_index
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM gadfly_turns
),
session_max AS (
  SELECT session_id, MAX(turn_index) AS max_idx
  FROM gadfly_turns
  GROUP BY session_id
),
displaced AS (
  SELECT r.id,
    sm.max_idx + ROW_NUMBER() OVER (
      PARTITION BY r.session_id ORDER BY r.turn_index, r.id
    ) AS new_turn_index
  FROM ranked r
  JOIN session_max sm ON r.session_id = sm.session_id
  WHERE r.rn > 1
)
UPDATE gadfly_turns SET turn_index = d.new_turn_index
FROM displaced d
WHERE gadfly_turns.id = d.id;

DROP INDEX IF EXISTS gadfly_turns_turn_index_idx;
CREATE UNIQUE INDEX IF NOT EXISTS gadfly_turns_session_turn_unique_idx
  ON gadfly_turns (session_id, turn_index);

-- 3. Make pattern_analysis nullable (BUG-F17)
ALTER TABLE mp_voting_patterns ALTER COLUMN pattern_analysis DROP NOT NULL;
