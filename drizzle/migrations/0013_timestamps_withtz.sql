-- Migration 0013: Convert all timestamp columns to timestamptz
--
-- Supabase defaults to UTC and the app writes via defaultNow() / JS new Date(),
-- so existing data is interpreted correctly with AT TIME ZONE 'UTC'.
-- PostgreSQL transactional DDL is the rollback mechanism — a failed ALTER
-- rolls back the entire transaction.

BEGIN;

-- magic_codes
ALTER TABLE magic_codes ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';
ALTER TABLE magic_codes ALTER COLUMN used_at TYPE timestamptz USING used_at AT TIME ZONE 'UTC';
ALTER TABLE magic_codes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- users
ALTER TABLE users ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN last_login_at TYPE timestamptz USING last_login_at AT TIME ZONE 'UTC';

-- investigations
ALTER TABLE investigations ALTER COLUMN briefing_completed_at TYPE timestamptz USING briefing_completed_at AT TIME ZONE 'UTC';
ALTER TABLE investigations ALTER COLUMN lens_opened_at TYPE timestamptz USING lens_opened_at AT TIME ZONE 'UTC';
ALTER TABLE investigations ALTER COLUMN lens_completed_at TYPE timestamptz USING lens_completed_at AT TIME ZONE 'UTC';
ALTER TABLE investigations ALTER COLUMN campaign_opened_at TYPE timestamptz USING campaign_opened_at AT TIME ZONE 'UTC';
ALTER TABLE investigations ALTER COLUMN preserved_at TYPE timestamptz USING preserved_at AT TIME ZONE 'UTC';
-- generation_started_at already timestamptz — skip
ALTER TABLE investigations ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE investigations ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- documents
ALTER TABLE documents ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE documents ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- document_chunks
ALTER TABLE document_chunks ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- analyses
ALTER TABLE analyses ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- cross_references
ALTER TABLE cross_references ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- gadfly_sessions
ALTER TABLE gadfly_sessions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE gadfly_sessions ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- gadfly_turns
ALTER TABLE gadfly_turns ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- insight_markers
ALTER TABLE insight_markers ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- lever_actions
ALTER TABLE lever_actions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE lever_actions ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- jurisdictions
ALTER TABLE jurisdictions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- jurisdiction_policies
ALTER TABLE jurisdiction_policies ALTER COLUMN last_verified_at TYPE timestamptz USING last_verified_at AT TIME ZONE 'UTC';
ALTER TABLE jurisdiction_policies ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- policy_outcomes
ALTER TABLE policy_outcomes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- scout_sources
ALTER TABLE scout_sources ALTER COLUMN cached_at TYPE timestamptz USING cached_at AT TIME ZONE 'UTC';

-- players
ALTER TABLE players ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE players ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- investigation_players
ALTER TABLE investigation_players ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- campaign_materials
ALTER TABLE campaign_materials ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE campaign_materials ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- regulatory_processes
ALTER TABLE regulatory_processes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE regulatory_processes ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- issue_tracking
ALTER TABLE issue_tracking ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- investigation_outcomes
ALTER TABLE investigation_outcomes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- user_profiles
ALTER TABLE user_profiles ALTER COLUMN display_name_changed_at TYPE timestamptz USING display_name_changed_at AT TIME ZONE 'UTC';
ALTER TABLE user_profiles ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE user_profiles ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- actor_keys
ALTER TABLE actor_keys ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- remote_followers
ALTER TABLE remote_followers ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- forum_threads
ALTER TABLE forum_threads ALTER COLUMN last_post_at TYPE timestamptz USING last_post_at AT TIME ZONE 'UTC';
ALTER TABLE forum_threads ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE forum_threads ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- forum_posts
ALTER TABLE forum_posts ALTER COLUMN edited_at TYPE timestamptz USING edited_at AT TIME ZONE 'UTC';
ALTER TABLE forum_posts ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE forum_posts ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- peer_reviews
ALTER TABLE peer_reviews ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE peer_reviews ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- content_reports
ALTER TABLE content_reports ALTER COLUMN reviewed_at TYPE timestamptz USING reviewed_at AT TIME ZONE 'UTC';
ALTER TABLE content_reports ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE content_reports ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- moderation_actions
ALTER TABLE moderation_actions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- credential_events
ALTER TABLE credential_events ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- archive_records
ALTER TABLE archive_records ALTER COLUMN preserved_at TYPE timestamptz USING preserved_at AT TIME ZONE 'UTC';
ALTER TABLE archive_records ALTER COLUMN permanence_at TYPE timestamptz USING permanence_at AT TIME ZONE 'UTC';
ALTER TABLE archive_records ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE archive_records ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- document_versions
ALTER TABLE document_versions ALTER COLUMN detected_at TYPE timestamptz USING detected_at AT TIME ZONE 'UTC';

-- archive_access_log
ALTER TABLE archive_access_log ALTER COLUMN accessed_at TYPE timestamptz USING accessed_at AT TIME ZONE 'UTC';

-- shadow_alerts
ALTER TABLE shadow_alerts ALTER COLUMN dismissed_at TYPE timestamptz USING dismissed_at AT TIME ZONE 'UTC';
ALTER TABLE shadow_alerts ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- governance_proposals
ALTER TABLE governance_proposals ALTER COLUMN voting_opens TYPE timestamptz USING voting_opens AT TIME ZONE 'UTC';
ALTER TABLE governance_proposals ALTER COLUMN voting_closes TYPE timestamptz USING voting_closes AT TIME ZONE 'UTC';
ALTER TABLE governance_proposals ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE governance_proposals ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- governance_votes
ALTER TABLE governance_votes ALTER COLUMN voted_at TYPE timestamptz USING voted_at AT TIME ZONE 'UTC';

-- governance_config
ALTER TABLE governance_config ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- federal_mps
ALTER TABLE federal_mps ALTER COLUMN last_synced_at TYPE timestamptz USING last_synced_at AT TIME ZONE 'UTC';
ALTER TABLE federal_mps ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE federal_mps ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- federal_bills
ALTER TABLE federal_bills ALTER COLUMN last_synced_at TYPE timestamptz USING last_synced_at AT TIME ZONE 'UTC';
ALTER TABLE federal_bills ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE federal_bills ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- federal_votes
ALTER TABLE federal_votes ALTER COLUMN last_synced_at TYPE timestamptz USING last_synced_at AT TIME ZONE 'UTC';
ALTER TABLE federal_votes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- federal_mp_ballots
ALTER TABLE federal_mp_ballots ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- mp_voting_patterns
ALTER TABLE mp_voting_patterns ALTER COLUMN generated_at TYPE timestamptz USING generated_at AT TIME ZONE 'UTC';
ALTER TABLE mp_voting_patterns ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- postal_code_cache
ALTER TABLE postal_code_cache ALTER COLUMN cached_at TYPE timestamptz USING cached_at AT TIME ZONE 'UTC';

-- parliament_sync_log
ALTER TABLE parliament_sync_log ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC';
ALTER TABLE parliament_sync_log ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';
ALTER TABLE parliament_sync_log ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- investigation_votes
ALTER TABLE investigation_votes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- feedback.created_at already timestamptz — skip

COMMIT;
