-- Migration 0014: Add CHECK constraints for peer_reviews rating columns
--
-- Pre-migration validation: run before applying
-- SELECT COUNT(*) FROM peer_reviews
-- WHERE factual_accuracy NOT BETWEEN 1 AND 5
--    OR source_quality NOT BETWEEN 1 AND 5
--    OR missing_context NOT BETWEEN 1 AND 5
--    OR strategic_effectiveness NOT BETWEEN 1 AND 5
--    OR jurisdictional_accuracy NOT BETWEEN 1 AND 5;
-- If non-zero, investigate before applying.

ALTER TABLE peer_reviews
  ADD CONSTRAINT chk_factual_accuracy
    CHECK (factual_accuracy BETWEEN 1 AND 5);

ALTER TABLE peer_reviews
  ADD CONSTRAINT chk_source_quality
    CHECK (source_quality BETWEEN 1 AND 5);

ALTER TABLE peer_reviews
  ADD CONSTRAINT chk_missing_context
    CHECK (missing_context BETWEEN 1 AND 5);

ALTER TABLE peer_reviews
  ADD CONSTRAINT chk_strategic_effectiveness
    CHECK (strategic_effectiveness BETWEEN 1 AND 5);

ALTER TABLE peer_reviews
  ADD CONSTRAINT chk_jurisdictional_accuracy
    CHECK (jurisdictional_accuracy BETWEEN 1 AND 5);
