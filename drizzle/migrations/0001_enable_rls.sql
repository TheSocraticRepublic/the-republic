-- Migration: Enable Row Level Security on all tables
-- Created: 2026-05-18
-- WARNING: Do NOT run this migration without review. Apply manually.
--
-- Strategy:
--   1. Enable and force RLS on every table
--   2. Grant service_role full access (bypasses RLS by default in Supabase,
--      but explicit GRANT ensures it works regardless of config)
--   3. User-owned tables (those with user_id): policies scoped to auth.uid()
--   4. Reference/lookup tables (jurisdictions, postalCodeCache, etc.): read-only for authenticated
--   5. actorKeys: private key material never readable via anon; only own keys visible
--   6. System/child tables: inherit access through parent ownership checks

-- ============================================================================
-- 1. ENABLE + FORCE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE magic_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_codes FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations FORCE ROW LEVEL SECURITY;

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses FORCE ROW LEVEL SECURITY;

ALTER TABLE cross_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_references FORCE ROW LEVEL SECURITY;

ALTER TABLE gadfly_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gadfly_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE gadfly_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE gadfly_turns FORCE ROW LEVEL SECURITY;

ALTER TABLE insight_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_markers FORCE ROW LEVEL SECURITY;

ALTER TABLE lever_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lever_actions FORCE ROW LEVEL SECURITY;

ALTER TABLE jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdictions FORCE ROW LEVEL SECURITY;

ALTER TABLE jurisdiction_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdiction_policies FORCE ROW LEVEL SECURITY;

ALTER TABLE policy_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_outcomes FORCE ROW LEVEL SECURITY;

ALTER TABLE scout_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scout_sources FORCE ROW LEVEL SECURITY;

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE players FORCE ROW LEVEL SECURITY;

ALTER TABLE investigation_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_players FORCE ROW LEVEL SECURITY;

ALTER TABLE campaign_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_materials FORCE ROW LEVEL SECURITY;

ALTER TABLE regulatory_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_processes FORCE ROW LEVEL SECURITY;

ALTER TABLE issue_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_tracking FORCE ROW LEVEL SECURITY;

ALTER TABLE investigation_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_outcomes FORCE ROW LEVEL SECURITY;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE actor_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE remote_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_followers FORCE ROW LEVEL SECURITY;

ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads FORCE ROW LEVEL SECURITY;

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts FORCE ROW LEVEL SECURITY;

ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions FORCE ROW LEVEL SECURITY;

ALTER TABLE credential_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_events FORCE ROW LEVEL SECURITY;

ALTER TABLE archive_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_records FORCE ROW LEVEL SECURITY;

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE archive_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_access_log FORCE ROW LEVEL SECURITY;

ALTER TABLE shadow_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_alerts FORCE ROW LEVEL SECURITY;

ALTER TABLE governance_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_proposals FORCE ROW LEVEL SECURITY;

ALTER TABLE governance_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_votes FORCE ROW LEVEL SECURITY;

ALTER TABLE governance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_config FORCE ROW LEVEL SECURITY;

ALTER TABLE federal_mps ENABLE ROW LEVEL SECURITY;
ALTER TABLE federal_mps FORCE ROW LEVEL SECURITY;

ALTER TABLE federal_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE federal_bills FORCE ROW LEVEL SECURITY;

ALTER TABLE federal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE federal_votes FORCE ROW LEVEL SECURITY;

ALTER TABLE federal_mp_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE federal_mp_ballots FORCE ROW LEVEL SECURITY;

ALTER TABLE mp_voting_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_voting_patterns FORCE ROW LEVEL SECURITY;

ALTER TABLE postal_code_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE postal_code_cache FORCE ROW LEVEL SECURITY;

ALTER TABLE parliament_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE parliament_sync_log FORCE ROW LEVEL SECURITY;

ALTER TABLE investigation_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_votes FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SERVICE ROLE — FULL ACCESS (bypasses RLS by default, but explicit for safety)
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================================
-- 3. USER-OWNED TABLES (user_id column) — CRUD scoped to own rows
-- ============================================================================

-- investigations
CREATE POLICY "investigations_select_own" ON investigations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "investigations_insert_own" ON investigations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "investigations_update_own" ON investigations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "investigations_delete_own" ON investigations FOR DELETE USING (user_id = auth.uid());

-- documents
CREATE POLICY "documents_select_own" ON documents FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "documents_insert_own" ON documents FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "documents_update_own" ON documents FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "documents_delete_own" ON documents FOR DELETE USING (user_id = auth.uid());

-- gadfly_sessions
CREATE POLICY "gadfly_sessions_select_own" ON gadfly_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "gadfly_sessions_insert_own" ON gadfly_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "gadfly_sessions_update_own" ON gadfly_sessions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "gadfly_sessions_delete_own" ON gadfly_sessions FOR DELETE USING (user_id = auth.uid());

-- lever_actions
CREATE POLICY "lever_actions_select_own" ON lever_actions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "lever_actions_insert_own" ON lever_actions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "lever_actions_update_own" ON lever_actions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "lever_actions_delete_own" ON lever_actions FOR DELETE USING (user_id = auth.uid());

-- campaign_materials
CREATE POLICY "campaign_materials_select_own" ON campaign_materials FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "campaign_materials_insert_own" ON campaign_materials FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaign_materials_update_own" ON campaign_materials FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "campaign_materials_delete_own" ON campaign_materials FOR DELETE USING (user_id = auth.uid());

-- regulatory_processes
CREATE POLICY "regulatory_processes_select_own" ON regulatory_processes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "regulatory_processes_insert_own" ON regulatory_processes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "regulatory_processes_update_own" ON regulatory_processes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "regulatory_processes_delete_own" ON regulatory_processes FOR DELETE USING (user_id = auth.uid());

-- issue_tracking
CREATE POLICY "issue_tracking_select_own" ON issue_tracking FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "issue_tracking_insert_own" ON issue_tracking FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "issue_tracking_update_own" ON issue_tracking FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "issue_tracking_delete_own" ON issue_tracking FOR DELETE USING (user_id = auth.uid());

-- investigation_outcomes
CREATE POLICY "investigation_outcomes_select_own" ON investigation_outcomes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "investigation_outcomes_insert_own" ON investigation_outcomes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "investigation_outcomes_update_own" ON investigation_outcomes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "investigation_outcomes_delete_own" ON investigation_outcomes FOR DELETE USING (user_id = auth.uid());

-- user_profiles (user_id is the owner, but profiles are publicly readable)
CREATE POLICY "user_profiles_select_all" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "user_profiles_insert_own" ON user_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_profiles_update_own" ON user_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_profiles_delete_own" ON user_profiles FOR DELETE USING (user_id = auth.uid());

-- actor_keys — SECURITY CRITICAL: private key material must never be readable via anon key
-- Only the key owner can read their own keys; public_key_pem exposed via AP endpoints using service_role
CREATE POLICY "actor_keys_select_own" ON actor_keys FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "actor_keys_insert_own" ON actor_keys FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "actor_keys_update_own" ON actor_keys FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "actor_keys_delete_own" ON actor_keys FOR DELETE USING (user_id = auth.uid());

-- remote_followers
CREATE POLICY "remote_followers_select_own" ON remote_followers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "remote_followers_insert_own" ON remote_followers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "remote_followers_update_own" ON remote_followers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "remote_followers_delete_own" ON remote_followers FOR DELETE USING (user_id = auth.uid());

-- credential_events
CREATE POLICY "credential_events_select_own" ON credential_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "credential_events_insert_own" ON credential_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "credential_events_update_own" ON credential_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "credential_events_delete_own" ON credential_events FOR DELETE USING (user_id = auth.uid());

-- archive_records
CREATE POLICY "archive_records_select_own" ON archive_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "archive_records_insert_own" ON archive_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "archive_records_update_own" ON archive_records FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "archive_records_delete_own" ON archive_records FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 4. TABLES WITH author_id / reviewer_id / reporter_id / moderator_id / voter_id
-- ============================================================================

-- forum_threads (publicly readable, author-owned for writes)
CREATE POLICY "forum_threads_select_all" ON forum_threads FOR SELECT USING (true);
CREATE POLICY "forum_threads_insert_own" ON forum_threads FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "forum_threads_update_own" ON forum_threads FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "forum_threads_delete_own" ON forum_threads FOR DELETE USING (author_id = auth.uid());

-- forum_posts (publicly readable, author-owned for writes)
CREATE POLICY "forum_posts_select_all" ON forum_posts FOR SELECT USING (true);
CREATE POLICY "forum_posts_insert_own" ON forum_posts FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "forum_posts_update_own" ON forum_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "forum_posts_delete_own" ON forum_posts FOR DELETE USING (author_id = auth.uid());

-- peer_reviews (readable by investigation owner + reviewer; writable by reviewer)
CREATE POLICY "peer_reviews_select_own" ON peer_reviews FOR SELECT
  USING (reviewer_id = auth.uid() OR EXISTS (SELECT 1 FROM investigations WHERE investigations.id = peer_reviews.investigation_id AND investigations.user_id = auth.uid()));
CREATE POLICY "peer_reviews_insert_own" ON peer_reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());
CREATE POLICY "peer_reviews_update_own" ON peer_reviews FOR UPDATE USING (reviewer_id = auth.uid());
CREATE POLICY "peer_reviews_delete_own" ON peer_reviews FOR DELETE USING (reviewer_id = auth.uid());

-- content_reports (reporter can see their own reports)
CREATE POLICY "content_reports_select_own" ON content_reports FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "content_reports_insert_own" ON content_reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- moderation_actions (admin-only via service_role; no anon/authenticated access)
-- No policies = deny all for non-service_role

-- governance_proposals (publicly readable, author-owned for writes)
CREATE POLICY "governance_proposals_select_all" ON governance_proposals FOR SELECT USING (true);
CREATE POLICY "governance_proposals_insert_own" ON governance_proposals FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "governance_proposals_update_own" ON governance_proposals FOR UPDATE USING (author_id = auth.uid());

-- governance_votes (voter can see and cast their own votes)
CREATE POLICY "governance_votes_select_own" ON governance_votes FOR SELECT USING (voter_id = auth.uid());
CREATE POLICY "governance_votes_insert_own" ON governance_votes FOR INSERT WITH CHECK (voter_id = auth.uid());

-- ============================================================================
-- 5. AUTH TABLE
-- ============================================================================

-- magic_codes — admin-only (service_role handles auth flow)
-- No policies = deny all for non-service_role

-- users — users can read their own row
CREATE POLICY "users_select_own" ON users FOR SELECT USING (id = auth.uid());

-- ============================================================================
-- 6. CHILD TABLES (access inherited through parent ownership)
--    These are accessed via service_role in practice (server-side queries).
--    Policies here are defense-in-depth.
-- ============================================================================

-- document_chunks (owned via documents.user_id)
CREATE POLICY "document_chunks_select_via_parent" ON document_chunks FOR SELECT
  USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "document_chunks_insert_via_parent" ON document_chunks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "document_chunks_delete_via_parent" ON document_chunks FOR DELETE
  USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_chunks.document_id AND documents.user_id = auth.uid()));

-- analyses (owned via documents.user_id)
CREATE POLICY "analyses_select_via_parent" ON analyses FOR SELECT
  USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = analyses.document_id AND documents.user_id = auth.uid()));
CREATE POLICY "analyses_insert_via_parent" ON analyses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM documents WHERE documents.id = analyses.document_id AND documents.user_id = auth.uid()));

-- cross_references (owned via documents.user_id on source doc)
CREATE POLICY "cross_references_select_via_parent" ON cross_references FOR SELECT
  USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = cross_references.source_doc_id AND documents.user_id = auth.uid()));

-- gadfly_turns (owned via gadfly_sessions.user_id)
CREATE POLICY "gadfly_turns_select_via_parent" ON gadfly_turns FOR SELECT
  USING (EXISTS (SELECT 1 FROM gadfly_sessions WHERE gadfly_sessions.id = gadfly_turns.session_id AND gadfly_sessions.user_id = auth.uid()));
CREATE POLICY "gadfly_turns_insert_via_parent" ON gadfly_turns FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM gadfly_sessions WHERE gadfly_sessions.id = gadfly_turns.session_id AND gadfly_sessions.user_id = auth.uid()));

-- insight_markers (owned via gadfly_sessions.user_id)
CREATE POLICY "insight_markers_select_via_parent" ON insight_markers FOR SELECT
  USING (EXISTS (SELECT 1 FROM gadfly_sessions WHERE gadfly_sessions.id = insight_markers.session_id AND gadfly_sessions.user_id = auth.uid()));
CREATE POLICY "insight_markers_insert_via_parent" ON insight_markers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM gadfly_sessions WHERE gadfly_sessions.id = insight_markers.session_id AND gadfly_sessions.user_id = auth.uid()));

-- investigation_players (junction — readable if user owns the investigation)
CREATE POLICY "investigation_players_select_via_parent" ON investigation_players FOR SELECT
  USING (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = investigation_players.investigation_id AND investigations.user_id = auth.uid()));
CREATE POLICY "investigation_players_insert_via_parent" ON investigation_players FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = investigation_players.investigation_id AND investigations.user_id = auth.uid()));
CREATE POLICY "investigation_players_delete_via_parent" ON investigation_players FOR DELETE
  USING (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = investigation_players.investigation_id AND investigations.user_id = auth.uid()));

-- investigation_votes (junction — readable if user owns the investigation)
CREATE POLICY "investigation_votes_select_via_parent" ON investigation_votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = investigation_votes.investigation_id AND investigations.user_id = auth.uid()));
CREATE POLICY "investigation_votes_insert_via_parent" ON investigation_votes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = investigation_votes.investigation_id AND investigations.user_id = auth.uid()));

-- document_versions (child of documents)
CREATE POLICY "document_versions_select_via_parent" ON document_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM documents WHERE documents.id = document_versions.document_id AND documents.user_id = auth.uid()));

-- archive_access_log (child of archive_records — readable by archive owner)
CREATE POLICY "archive_access_log_select_via_parent" ON archive_access_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM archive_records WHERE archive_records.id = archive_access_log.archive_record_id AND archive_records.user_id = auth.uid()));
-- Insert is open to any authenticated user (privacy-respecting access log, no userId stored)
CREATE POLICY "archive_access_log_insert_authenticated" ON archive_access_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- shadow_alerts (child of investigations)
CREATE POLICY "shadow_alerts_select_via_parent" ON shadow_alerts FOR SELECT
  USING (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = shadow_alerts.investigation_id AND investigations.user_id = auth.uid()));
CREATE POLICY "shadow_alerts_update_via_parent" ON shadow_alerts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM investigations WHERE investigations.id = shadow_alerts.investigation_id AND investigations.user_id = auth.uid()));

-- ============================================================================
-- 7. REFERENCE / LOOKUP TABLES — read-only for authenticated users
-- ============================================================================

-- jurisdictions
CREATE POLICY "jurisdictions_select_authenticated" ON jurisdictions FOR SELECT USING (auth.uid() IS NOT NULL);

-- jurisdiction_policies
CREATE POLICY "jurisdiction_policies_select_authenticated" ON jurisdiction_policies FOR SELECT USING (auth.uid() IS NOT NULL);

-- policy_outcomes
CREATE POLICY "policy_outcomes_select_authenticated" ON policy_outcomes FOR SELECT USING (auth.uid() IS NOT NULL);

-- scout_sources
CREATE POLICY "scout_sources_select_authenticated" ON scout_sources FOR SELECT USING (auth.uid() IS NOT NULL);

-- players
CREATE POLICY "players_select_authenticated" ON players FOR SELECT USING (auth.uid() IS NOT NULL);

-- governance_config
CREATE POLICY "governance_config_select_authenticated" ON governance_config FOR SELECT USING (auth.uid() IS NOT NULL);

-- postal_code_cache
CREATE POLICY "postal_code_cache_select_authenticated" ON postal_code_cache FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 8. PARLIAMENT TABLES — read-only for authenticated users (admin-write via service_role)
-- ============================================================================

CREATE POLICY "federal_mps_select_authenticated" ON federal_mps FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "federal_bills_select_authenticated" ON federal_bills FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "federal_votes_select_authenticated" ON federal_votes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "federal_mp_ballots_select_authenticated" ON federal_mp_ballots FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mp_voting_patterns_select_authenticated" ON mp_voting_patterns FOR SELECT USING (auth.uid() IS NOT NULL);

-- parliament_sync_log — admin-only (service_role writes sync logs)
-- No policies = deny all for non-service_role
