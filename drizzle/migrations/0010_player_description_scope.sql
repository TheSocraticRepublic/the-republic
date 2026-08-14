-- Migration 0010: Remove players.description (Batch C6)
--
-- players.description carried LLM-generated text from one user's private
-- briefing into a global, name-keyed table. First writer wins — a privacy
-- leak and a defamation exposure. The description is regenerable model output;
-- dropping it is cheaper and safer than backfilling to junction rows.
--
-- Idempotent: safe to re-run.
ALTER TABLE players DROP COLUMN IF EXISTS description;
