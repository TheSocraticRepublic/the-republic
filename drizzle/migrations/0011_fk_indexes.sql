-- 0011_fk_indexes.sql
-- Add unique constraint on credential_events + indexes for 19 unindexed FK columns.

-- Credential events: partial unique index (WHERE source_id IS NOT NULL)
-- Prevents double-awarding credentials for the same user+type+source.
CREATE UNIQUE INDEX IF NOT EXISTS credential_events_user_type_source_unique_idx
  ON credential_events (user_id, credential_type, source_id)
  WHERE source_id IS NOT NULL;

-- Account-deletion cascade path
CREATE INDEX IF NOT EXISTS campaign_materials_user_id_idx ON campaign_materials (user_id);
CREATE INDEX IF NOT EXISTS issue_tracking_user_id_idx ON issue_tracking (user_id);
CREATE INDEX IF NOT EXISTS investigation_outcomes_user_id_idx ON investigation_outcomes (user_id);
CREATE INDEX IF NOT EXISTS governance_votes_voter_id_idx ON governance_votes (voter_id);

-- Other FK columns
CREATE INDEX IF NOT EXISTS investigations_jurisdiction_id_idx ON investigations (jurisdiction_id);
CREATE INDEX IF NOT EXISTS investigations_federal_mp_id_idx ON investigations (federal_mp_id);
CREATE INDEX IF NOT EXISTS gadfly_sessions_document_id_idx ON gadfly_sessions (document_id);
CREATE INDEX IF NOT EXISTS lever_actions_session_id_idx ON lever_actions (session_id);
CREATE INDEX IF NOT EXISTS lever_actions_document_id_idx ON lever_actions (document_id);
CREATE INDEX IF NOT EXISTS players_jurisdiction_id_idx ON players (jurisdiction_id);
CREATE INDEX IF NOT EXISTS regulatory_processes_jurisdiction_id_idx ON regulatory_processes (jurisdiction_id);
CREATE INDEX IF NOT EXISTS regulatory_processes_proponent_player_id_idx ON regulatory_processes (proponent_player_id);
CREATE INDEX IF NOT EXISTS investigation_votes_vote_id_idx ON investigation_votes (vote_id);
CREATE INDEX IF NOT EXISTS investigation_outcomes_document_id_idx ON investigation_outcomes (document_id);
CREATE INDEX IF NOT EXISTS content_reports_reviewed_by_idx ON content_reports (reviewed_by);
CREATE INDEX IF NOT EXISTS document_versions_previous_version_id_idx ON document_versions (previous_version_id);
CREATE INDEX IF NOT EXISTS governance_config_updated_by_idx ON governance_config (updated_by);
CREATE INDEX IF NOT EXISTS federal_bills_sponsor_mp_id_idx ON federal_bills (sponsor_mp_id);
CREATE INDEX IF NOT EXISTS postal_code_cache_mp_id_idx ON postal_code_cache (mp_id);
