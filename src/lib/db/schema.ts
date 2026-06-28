import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  timestamp,
  pgEnum,
  real,
  jsonb,
  numeric,
  date,
  index,
  uniqueIndex,
  boolean,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { customType } from 'drizzle-orm/pg-core'

// pgvector custom type
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`
    },
    fromDriver(value: string): number[] {
      return value
        .slice(1, -1)
        .split(',')
        .map(Number)
    },
  })(name)

// --- Enums ---

export const documentTypeEnum = pgEnum('document_type', [
  'zoning_bylaw',
  'budget',
  'council_minutes',
  'environmental_assessment',
  'policy',
  'foi_response',
  'lobbyist_registration',
  'campaign_finance',
  'other',
  'environmental_impact_statement',
  'environmental_assessment_report',
  'scoping_document',
  'record_of_decision',
  'biological_opinion',
  'habitat_assessment',
])

export const documentStatusEnum = pgEnum('document_status', [
  'processing',
  'ready',
  'failed',
])

export const crossReferenceTypeEnum = pgEnum('cross_reference_type', [
  'cites',
  'contradicts',
  'amends',
  'supersedes',
  'references',
])

export const gadflyCycleEnum = pgEnum('gadfly_mode', ['socratic', 'direct'])

export const gadflyStatusEnum = pgEnum('gadfly_status', [
  'active',
  'completed',
  'abandoned',
])

export const gadflyRoleEnum = pgEnum('gadfly_role', ['gadfly', 'citizen'])

export const gadflyQuestionTypeEnum = pgEnum('gadfly_question_type', [
  'clarifying',
  'probing',
  'challenging',
  'connecting',
  'action',
])

export const leverActionTypeEnum = pgEnum('lever_action_type', [
  'fippa_request',
  'public_comment',
  'policy_brief',
  'legal_template',
  'media_spec',
  'talking_points',
  'coalition_template',
  'mp_letter',
])

export const leverStatusEnum = pgEnum('lever_status', [
  'draft',
  'final',
  'filed',
])

export const municipalTypeEnum = pgEnum('municipal_type', [
  'city',
  'district',
  'regional_district',
  'township',
  'village',
  'province',
  'federal',
])

export const policyAreaEnum = pgEnum('policy_area', [
  'zoning',
  'housing',
  'transit',
  'budget_transparency',
  'environment',
  'foi_transparency',
  'procurement',
  'other',
  'conservation',
  'extraction',
  'land_use',
  'water_rights',
])

export const investigationStatusEnum = pgEnum('investigation_status', [
  'active',
  'archived',
  'generating',
  'complete',
  'failed',
  'cancelled',
])

export const playerTypeEnum = pgEnum('player_type', [
  'company',
  'official',
  'agency',
  'organization',
  'rights_holder',
])

export const investigationPlayerRoleEnum = pgEnum('investigation_player_role', [
  'beneficiary',
  'decision_maker',
  'affected',
  'proponent',
  'regulator',
  'rights_holder',
  'title_holder',
])

export const campaignMaterialTypeEnum = pgEnum('campaign_material_type', [
  'infographic',
  'fact_sheet',
  'social_post',
  'talking_points',
  'coalition_template',
  'timeline',
  'comparison',
])

export const campaignMaterialStatusEnum = pgEnum('campaign_material_status', [
  'draft',
  'final',
])

export const campaignMaterialFormatEnum = pgEnum('campaign_material_format', [
  'json',
  'markdown',
  'html',
])

export const regulatoryFrameworkEnum = pgEnum('regulatory_framework', [
  'bc_eao',
  'iaa',
  'nepa',
  'provincial_ea',
  'other',
])

export const issueEventTypeEnum = pgEnum('issue_event_type', [
  'deadline',
  'meeting',
  'decision',
  'comment_period',
  'custom',
])

export const issueStatusEnum = pgEnum('issue_status', [
  'upcoming',
  'passed',
  'completed',
])

export const outcomeTypeEnum = pgEnum('outcome_type', [
  'fippa_response_received',
  'comment_submitted',
  'council_presentation',
  'media_coverage',
  'policy_change',
  'assessment_decision',
  'other',
])

export const threadStatusEnum = pgEnum('thread_status', [
  'open',
  'locked',
  'archived',
])

export const postStatusEnum = pgEnum('post_status', [
  'visible',
  'hidden',
  'removed_by_author',
])

export const credentialTypeEnum = pgEnum('credential_type', [
  'investigation_completed',
  'foi_filed',
  'foi_response_shared',
  'campaign_used',
  'outcome_tracked',
  'forum_contribution',
  'peer_review',
  'jurisdiction_contributed',
  'code_contributed',
  'bug_report',
  'translation',
  'investigation_archived',
])

export const credentialSourceEnum = pgEnum('credential_source', [
  'investigation',
  'peer_review',
  'forum_post',
  'campaign_material',
  'lever_action',
  'outcome',
  'archive_record',
])

// --- Archive Enums (Phase 2) ---

export const archiveStatusEnum = pgEnum('archive_status', [
  'pending',
  'ipfs_pinned',
  'arweave_permanent',
  'failed',
])

export const documentChangeTypeEnum = pgEnum('document_change_type', [
  'content_changed',
  'metadata_changed',
  'deleted',
  'retracted',
])

export const shadowAlertTypeEnum = pgEnum('shadow_alert_type', [
  'missing_topic',
  'missing_entity',
  'missing_jurisdiction_pattern',
])

export const archiveAccessTypeEnum = pgEnum('archive_access_type', [
  'ipfs_gateway',
  'arweave_direct',
  'republic_app',
])

// --- Tables ---

export const magicCodes = pgTable(
  'magic_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    code: text('code').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    attempts: integer('attempts').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('magic_codes_email_idx').on(t.email)]
)

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
})

// investigations is defined before documents so that documents can FK to it
export const investigations = pgTable(
  'investigations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    concern: text('concern').notNull(),
    jurisdictionId: uuid('jurisdiction_id').references(() => jurisdictions.id, {
      onDelete: 'set null',
    }),
    jurisdictionName: text('jurisdiction_name'),
    policyArea: policyAreaEnum('policy_area'),
    briefingText: text('briefing_text'),
    briefingCompletedAt: timestamp('briefing_completed_at'),
    lensOpenedAt: timestamp('lens_opened_at'),
    lensContextText: text('lens_context_text'),
    lensCompletedAt: timestamp('lens_completed_at'),
    gadflySeededQuestion: text('gadfly_seeded_question'),
    postalCode: text('postal_code'),
    federalMpId: uuid('federal_mp_id').references(() => federalMps.id, {
      onDelete: 'set null',
    }),
    campaignOpenedAt: timestamp('campaign_opened_at'),
    concernCategory: text('concern_category'),
    environmentalReviewType: text('environmental_review_type'),
    status: investigationStatusEnum('status').notNull().default('generating'),
    // failureReason: populated when status transitions to 'failed' or 'cancelled'.
    // Stores the error message, timeout notice, or cancellation reason for user display.
    failureReason: text('failure_reason'),
    // preservedAt: timestamp when this investigation was submitted for archiving.
    // Named preservedAt (not archivedAt) to avoid collision with investigationStatusEnum.archived.
    preservedAt: timestamp('preserved_at'),
    // generationStartedAt: set when status transitions to 'generating'. Used by the
    // scheduled reaper and render-time reaper to detect stuck rows. Keyed on this
    // (not createdAt) so a retried row — with an old createdAt — isn't reaped instantly.
    generationStartedAt: timestamp('generation_started_at', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('investigations_user_id_idx').on(t.userId),
    index('investigations_status_idx').on(t.status),
    index('investigations_created_at_idx').on(t.createdAt),
  ]
)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sourceUrl: text('source_url'),
    documentType: documentTypeEnum('document_type').notNull().default('other'),
    rawText: text('raw_text'),
    pageCount: integer('page_count'),
    wordCount: integer('word_count'),
    extractionQuality: real('extraction_quality'),
    status: documentStatusEnum('status').notNull().default('processing'),
    investigationId: uuid('investigation_id').references(
      () => investigations.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('documents_user_id_idx').on(t.userId),
    index('documents_status_idx').on(t.status),
    index('documents_investigation_id_idx').on(t.investigationId),
  ]
)

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    sectionHeading: text('section_heading'),
    embedding: vector('embedding', 1024),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('chunks_document_id_idx').on(t.documentId),
    index('chunks_chunk_index_idx').on(t.documentId, t.chunkIndex),
  ]
)

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    summary: text('summary'),
    keyFindings: jsonb('key_findings'),
    powerMap: jsonb('power_map'),
    missingInfo: jsonb('missing_info'),
    hiddenAssumptions: jsonb('hidden_assumptions'),
    questionsToAsk: jsonb('questions_to_ask'),
    model: text('model'),
    promptVersion: text('prompt_version'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('analyses_document_id_idx').on(t.documentId)]
)

export const crossReferences = pgTable(
  'cross_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceDocId: uuid('source_doc_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    targetDocId: uuid('target_doc_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    relationshipType: crossReferenceTypeEnum('relationship_type').notNull(),
    description: text('description'),
    confidence: real('confidence'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('xref_source_doc_idx').on(t.sourceDocId),
    index('xref_target_doc_idx').on(t.targetDocId),
  ]
)

export const gadflySessions = pgTable(
  'gadfly_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    complexityLevel: integer('complexity_level').notNull().default(1),
    questionCount: integer('question_count').notNull().default(0),
    insightCount: integer('insight_count').notNull().default(0),
    mode: gadflyCycleEnum('mode').notNull().default('socratic'),
    status: gadflyStatusEnum('status').notNull().default('active'),
    investigationId: uuid('investigation_id').references(
      () => investigations.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('gadfly_sessions_user_id_idx').on(t.userId),
    index('gadfly_sessions_status_idx').on(t.status),
    index('gadfly_sessions_investigation_id_idx').on(t.investigationId),
  ]
)

export const gadflyTurns = pgTable(
  'gadfly_turns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => gadflySessions.id, { onDelete: 'cascade' }),
    role: gadflyRoleEnum('role').notNull(),
    content: text('content').notNull(),
    questionType: gadflyQuestionTypeEnum('question_type'),
    turnIndex: integer('turn_index').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('gadfly_turns_session_id_idx').on(t.sessionId),
    index('gadfly_turns_turn_index_idx').on(t.sessionId, t.turnIndex),
  ]
)

export const insightMarkers = pgTable(
  'insight_markers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    turnId: uuid('turn_id')
      .notNull()
      .references(() => gadflyTurns.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => gadflySessions.id, { onDelete: 'cascade' }),
    insight: text('insight').notNull(),
    category: text('category'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('insight_markers_session_id_idx').on(t.sessionId),
    index('insight_markers_turn_id_idx').on(t.turnId),
  ]
)

export const leverActions = pgTable(
  'lever_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => gadflySessions.id, {
      onDelete: 'set null',
    }),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    actionType: leverActionTypeEnum('action_type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    pdfUrl: text('pdf_url'),
    status: leverStatusEnum('status').notNull().default('draft'),
    investigationId: uuid('investigation_id').references(
      () => investigations.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('lever_actions_user_id_idx').on(t.userId),
    index('lever_actions_status_idx').on(t.status),
    index('lever_actions_investigation_id_idx').on(t.investigationId),
  ]
)

export const jurisdictions = pgTable(
  'jurisdictions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    country: text('country').notNull(),
    province: text('province'),
    municipalType: municipalTypeEnum('municipal_type').notNull(),
    population: integer('population'),
    annualBudget: numeric('annual_budget'),
    dataPortalUrl: text('data_portal_url'),
    fippaBody: text('fippa_body'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('jurisdictions_country_idx').on(t.country),
    index('jurisdictions_province_idx').on(t.province),
  ]
)

export const jurisdictionPolicies = pgTable(
  'jurisdiction_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jurisdictionId: uuid('jurisdiction_id')
      .notNull()
      .references(() => jurisdictions.id, { onDelete: 'cascade' }),
    policyArea: policyAreaEnum('policy_area').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    embedding: vector('embedding', 1024),
    sourceUrl: text('source_url'),
    implementedDate: date('implemented_date'),
    lastVerifiedAt: timestamp('last_verified_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('jp_jurisdiction_id_idx').on(t.jurisdictionId),
    index('jp_policy_area_idx').on(t.policyArea),
  ]
)

export const policyOutcomes = pgTable(
  'policy_outcomes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => jurisdictionPolicies.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    value: text('value').notNull(),
    measureDate: date('measure_date').notNull(),
    sourceUrl: text('source_url').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('policy_outcomes_policy_id_idx').on(t.policyId),
    index('policy_outcomes_measure_date_idx').on(t.measureDate),
  ]
)

export const scoutSources = pgTable(
  'scout_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jurisdictionName: text('jurisdiction_name').notNull(),
    documentType: text('document_type').notNull(),
    searchQuery: text('search_query').notNull(),
    url: text('url').notNull(),
    title: text('title'),
    snippet: text('snippet'),
    verified: boolean('verified').notNull().default(false),
    cachedAt: timestamp('cached_at').defaultNow().notNull(),
  },
  (t) => [
    index('scout_sources_jurisdiction_idx').on(t.jurisdictionName),
    index('scout_sources_doc_type_idx').on(t.documentType),
  ]
)

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    playerType: playerTypeEnum('player_type').notNull(),
    jurisdictionId: uuid('jurisdiction_id').references(() => jurisdictions.id, {
      onDelete: 'set null',
    }),
    description: text('description'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('players_name_idx').on(t.name),
    index('players_type_idx').on(t.playerType),
  ]
)

export const investigationPlayers = pgTable(
  'investigation_players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    role: investigationPlayerRoleEnum('role').notNull(),
    context: text('context'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('inv_players_investigation_idx').on(t.investigationId),
    index('inv_players_player_idx').on(t.playerId),
    uniqueIndex('inv_players_unique_role_idx').on(
      t.investigationId,
      t.playerId,
      t.role
    ),
  ]
)

export const campaignMaterials = pgTable(
  'campaign_materials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    materialType: campaignMaterialTypeEnum('material_type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    reasoning: text('reasoning'),
    format: campaignMaterialFormatEnum('format').notNull().default('json'),
    metadata: jsonb('metadata'),
    status: campaignMaterialStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('campaign_materials_investigation_idx').on(t.investigationId),
    index('campaign_materials_type_idx').on(t.materialType),
  ]
)

export const regulatoryProcesses = pgTable(
  'regulatory_processes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id').references(
      () => investigations.id,
      { onDelete: 'set null' }
    ),
    // userId is the fallback owner anchor: if the linked investigation is deleted,
    // this row remains owned by the user and doesn't become fully orphaned.
    // Matches the pattern used by campaignMaterials, issueTracking, and investigationOutcomes.
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jurisdictionId: uuid('jurisdiction_id').references(() => jurisdictions.id, {
      onDelete: 'set null',
    }),
    processName: text('process_name').notNull(),
    framework: regulatoryFrameworkEnum('framework').notNull(),
    projectName: text('project_name').notNull(),
    proponentName: text('proponent_name'),
    proponentPlayerId: uuid('proponent_player_id').references(() => players.id, {
      onDelete: 'set null',
    }),
    status: text('status'),
    commentPeriodOpens: date('comment_period_opens'),
    commentPeriodCloses: date('comment_period_closes'),
    commentSubmissionUrl: text('comment_submission_url'),
    registryUrl: text('registry_url'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('reg_processes_investigation_idx').on(t.investigationId),
    index('reg_processes_user_id_idx').on(t.userId),
    index('reg_processes_framework_idx').on(t.framework),
    index('reg_processes_comment_closes_idx').on(t.commentPeriodCloses),
  ]
)

export const issueTracking = pgTable(
  'issue_tracking',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: issueEventTypeEnum('event_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    eventDate: date('event_date').notNull(),
    reminderSent: boolean('reminder_sent').notNull().default(false),
    status: issueStatusEnum('status').notNull().default('upcoming'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('issue_tracking_investigation_idx').on(t.investigationId),
    index('issue_tracking_event_date_idx').on(t.eventDate),
    index('issue_tracking_status_idx').on(t.status),
  ]
)

export const investigationOutcomes = pgTable(
  'investigation_outcomes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    outcomeType: outcomeTypeEnum('outcome_type').notNull(),
    description: text('description').notNull(),
    outcomeDate: date('outcome_date'),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    // satisfaction: expected range 1-5 (smallint signals intent).
    // A CHECK (satisfaction >= 1 AND satisfaction <= 5) constraint should be added in migration SQL.
    satisfaction: smallint('satisfaction'),
    lessonsLearned: text('lessons_learned'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('inv_outcomes_investigation_idx').on(t.investigationId),
    index('inv_outcomes_type_idx').on(t.outcomeType),
  ]
)

// --- Forum / Identity Tables ---

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull().unique(),
    // apHandle is the immutable ActivityPub identity. Set to displayName at
    // profile creation and never changed — even if displayName is later renamed.
    // All AP actor URIs are keyed on this value.
    apHandle: text('ap_handle').unique(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    displayNameChangedAt: timestamp('display_name_changed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('user_profiles_user_id_idx').on(t.userId),
    index('user_profiles_display_name_idx').on(t.displayName),
    index('user_profiles_ap_handle_idx').on(t.apHandle),
  ]
)

// --- ActivityPub Tables ---

// RSA key pairs for HTTP Signature signing. Stored separately from userProfiles
// so private key material is never co-queried with profile display data.
//
// SECURITY: Private key material. If using Supabase PostgREST, this table MUST
// have RLS enabled. DO NOT expose via client API. RLS policy: SELECT only where
// user_id = auth.uid(). The private key column should never appear in any API
// response — query only publicKeyPem in public-facing endpoints.
export const actorKeys = pgTable(
  'actor_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKeyPem: text('public_key_pem').notNull(),
    privateKeyPem: text('private_key_pem').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('actor_keys_user_id_idx').on(t.userId)]
)

// Fediverse actors (Mastodon users, etc.) following Open Cave users.
// actorUri is the canonical AP actor URL from the remote instance.
export const remoteFollowers = pgTable(
  'remote_followers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorUri: text('actor_uri').notNull(),
    actorInbox: text('actor_inbox').notNull(),
    sharedInbox: text('shared_inbox'),
    displayName: text('display_name'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('remote_followers_user_id_idx').on(t.userId),
    uniqueIndex('remote_followers_unique_idx').on(t.userId, t.actorUri),
  ]
)

export const forumThreads = pgTable(
  'forum_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id').references(() => investigations.id, {
      onDelete: 'set null',
    }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    jurisdictionId: uuid('jurisdiction_id').references(() => jurisdictions.id, {
      onDelete: 'set null',
    }),
    concernCategory: text('concern_category'),
    status: threadStatusEnum('status').notNull().default('open'),
    pinned: boolean('pinned').notNull().default(false),
    postCount: integer('post_count').notNull().default(0),
    lastPostAt: timestamp('last_post_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('forum_threads_author_id_idx').on(t.authorId),
    index('forum_threads_investigation_id_idx').on(t.investigationId),
    index('forum_threads_status_idx').on(t.status),
    index('forum_threads_jurisdiction_id_idx').on(t.jurisdictionId),
  ]
)

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // parentId uses set null so nested replies survive parent deletion gracefully
    parentId: uuid('parent_id').references((): AnyPgColumn => forumPosts.id, {
      onDelete: 'set null',
    }),
    content: text('content').notNull(),
    editedAt: timestamp('edited_at'),
    status: postStatusEnum('status').notNull().default('visible'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('forum_posts_thread_id_idx').on(t.threadId),
    index('forum_posts_author_id_idx').on(t.authorId),
    index('forum_posts_parent_id_idx').on(t.parentId),
  ]
)

export const peerReviews = pgTable(
  'peer_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    factualAccuracy: smallint('factual_accuracy').notNull(),
    sourceQuality: smallint('source_quality').notNull(),
    missingContext: smallint('missing_context').notNull(),
    strategicEffectiveness: smallint('strategic_effectiveness').notNull(),
    jurisdictionalAccuracy: smallint('jurisdictional_accuracy').notNull(),
    summary: text('summary'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('peer_reviews_investigation_id_idx').on(t.investigationId),
    index('peer_reviews_reviewer_id_idx').on(t.reviewerId),
    uniqueIndex('peer_reviews_unique_idx').on(t.investigationId, t.reviewerId),
  ]
)

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'misinformation',
  'off_topic',
  'other',
])

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'reviewed', // W7: reserved for future use (e.g. "seen but not yet actioned"); not currently assigned by any code path
  'dismissed',
  'actioned',
])

export const moderationActionTypeEnum = pgEnum('moderation_action_type', [
  'hide_post',
  'unhide_post',
  'lock_thread',
  'unlock_thread',
  'dismiss_report',
  'appeal',
])

export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'thread',
  'post',
])

// --- Moderation Tables ---

export const contentReports = pgTable(
  'content_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    description: text('description'),
    status: reportStatusEnum('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('content_reports_reporter_id_idx').on(t.reporterId),
    index('content_reports_status_idx').on(t.status),
    index('content_reports_target_idx').on(t.targetType, t.targetId),
    index('content_reports_created_at_idx').on(t.createdAt),
    uniqueIndex('content_reports_unique_reporter_target_idx').on(
      t.reporterId,
      t.targetType,
      t.targetId
    ),
  ]
)

export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    moderatorId: uuid('moderator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actionType: moderationActionTypeEnum('action_type').notNull(),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    relatedReportId: uuid('related_report_id').references(
      () => contentReports.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('moderation_actions_moderator_id_idx').on(t.moderatorId),
    index('moderation_actions_target_idx').on(t.targetType, t.targetId),
    index('moderation_actions_related_report_idx').on(t.relatedReportId),
    index('moderation_actions_created_at_idx').on(t.createdAt),
  ]
)

export const credentialEvents = pgTable(
  'credential_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialType: credentialTypeEnum('credential_type').notNull(),
    weight: integer('weight').notNull(),
    // Polymorphic reference — references investigations/peerReviews/forumPosts/campaignMaterials/leverActions/investigationOutcomes by sourceType.
    // Referential integrity is application-enforced.
    sourceId: uuid('source_id'),
    sourceType: credentialSourceEnum('source_type'),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('credential_events_user_id_idx').on(t.userId),
    index('credential_events_credential_type_idx').on(t.credentialType),
    index('credential_events_source_id_idx').on(t.sourceId),
  ]
)

// --- Archive Tables (Phase 2) ---

export const archiveRecords = pgTable(
  'archive_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    archiveStatus: archiveStatusEnum('archive_status').notNull().default('pending'),
    ipfsCid: text('ipfs_cid'),
    arweaveTxId: text('arweave_tx_id'),
    contentHash: text('content_hash'),
    preservedAt: timestamp('preserved_at'),
    permanenceAt: timestamp('permanence_at'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('archive_records_investigation_id_unique_idx').on(t.investigationId),
    index('archive_records_user_id_idx').on(t.userId),
    index('archive_records_status_idx').on(t.archiveStatus),
  ]
)

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    contentHash: text('content_hash'),
    // Self-referential FK: previousVersionId references this same table.
    // onDelete: 'set null' so version chains survive individual node deletion gracefully.
    previousVersionId: uuid('previous_version_id').references(
      (): AnyPgColumn => documentVersions.id,
      { onDelete: 'set null' }
    ),
    diffSummary: text('diff_summary'),
    changeType: documentChangeTypeEnum('change_type').notNull(),
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
  },
  (t) => [index('document_versions_document_id_idx').on(t.documentId)]
)

export const archiveAccessLog = pgTable(
  'archive_access_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    archiveRecordId: uuid('archive_record_id')
      .notNull()
      .references(() => archiveRecords.id, { onDelete: 'cascade' }),
    accessType: archiveAccessTypeEnum('access_type').notNull(),
    // No userId column — privacy-respecting access log
    accessedAt: timestamp('accessed_at').defaultNow().notNull(),
  },
  (t) => [index('archive_access_log_record_id_idx').on(t.archiveRecordId)]
)

export const shadowAlerts = pgTable(
  'shadow_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    alertType: shadowAlertTypeEnum('alert_type').notNull(),
    missingTopic: text('missing_topic').notNull(),
    // PostgreSQL text[] — stores UUIDs as text strings for flexibility
    referenceInvestigationIds: text('reference_investigation_ids').array(),
    // confidence: float4, matches existing crossReferences pattern
    confidence: real('confidence').notNull(),
    dismissedAt: timestamp('dismissed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('shadow_alerts_investigation_id_idx').on(t.investigationId)]
)

// --- Governance Tables (Phase 2F) ---

export const voteChoiceEnum = pgEnum('vote_choice', ['for', 'against', 'abstain'])

export const proposalTypeEnum = pgEnum('proposal_type', [
  'policy',
  'feature',
  'constitutional',
  'funding',
])

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'active',
  'passed',
  'rejected',
  'executed',
])

export const governanceProposals = pgTable(
  'governance_proposals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    proposalType: proposalTypeEnum('proposal_type').notNull(),
    status: proposalStatusEnum('status').notNull().default('draft'),
    votingOpens: timestamp('voting_opens'),
    votingCloses: timestamp('voting_closes'),
    // quorumThreshold: valid range is [0, 1]. Cannot be enforced via Drizzle CHECK
    // constraint — application-layer validation is required before persisting.
    quorumThreshold: real('quorum_threshold'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('proposals_author_id_idx').on(t.authorId),
    index('proposals_status_idx').on(t.status),
  ]
)

export const governanceVotes = pgTable(
  'governance_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => governanceProposals.id, { onDelete: 'cascade' }),
    voterId: uuid('voter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    choice: voteChoiceEnum('choice').notNull(),
    weight: real('weight').notNull(),
    rawCredentialWeight: real('raw_credential_weight').notNull(),
    votedAt: timestamp('voted_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('votes_proposal_voter_unique_idx').on(t.proposalId, t.voterId),
    index('votes_proposal_id_idx').on(t.proposalId),
  ]
)

export const governanceConfig = pgTable('governance_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// --- Parliament / Vote Tracker Tables ---

export const voteResultEnum = pgEnum('vote_result', [
  'passed',
  'defeated',
  'tie',
])

export const mpBallotEnum = pgEnum('mp_ballot', [
  'yes',
  'no',
  'paired',
  'didnt_vote',
])

export const federalMps = pgTable(
  'federal_mps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    oparlSlug: text('oparl_slug').notNull().unique(),
    name: text('name').notNull(),
    party: text('party').notNull(),
    ridingName: text('riding_name').notNull(),
    ridingProvince: text('riding_province').notNull(),
    email: text('email'),
    photoUrl: text('photo_url'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata'),
    lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('federal_mps_riding_province_idx').on(t.ridingProvince),
    index('federal_mps_party_idx').on(t.party),
    index('federal_mps_active_idx').on(t.active),
  ]
)

export const federalBills = pgTable(
  'federal_bills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    number: text('number').notNull(),
    titleEn: text('title_en').notNull(),
    titleFr: text('title_fr'),
    shortTitleEn: text('short_title_en'),
    sponsorMpId: uuid('sponsor_mp_id').references(() => federalMps.id, {
      onDelete: 'set null',
    }),
    session: text('session').notNull(),
    statusCode: text('status_code'),
    introduced: date('introduced'),
    isLaw: boolean('is_law'),
    legisInfoUrl: text('legis_info_url'),
    aiSummary: text('ai_summary'),
    aiSummaryPromptVersion: text('ai_summary_prompt_version'),
    metadata: jsonb('metadata'),
    lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('federal_bills_session_number_idx').on(t.session, t.number),
    index('federal_bills_session_idx').on(t.session),
  ]
)

export const federalVotes = pgTable(
  'federal_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    session: text('session').notNull(),
    number: integer('number').notNull(),
    date: date('date').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionFr: text('description_fr'),
    result: voteResultEnum('result').notNull(),
    yeaTotal: integer('yea_total').notNull(),
    nayTotal: integer('nay_total').notNull(),
    pairedTotal: integer('paired_total'),
    partyVotes: jsonb('party_votes'),
    billId: uuid('bill_id').references(() => federalBills.id, {
      onDelete: 'set null',
    }),
    aiExplanation: text('ai_explanation'),
    aiExplanationPromptVersion: text('ai_explanation_prompt_version'),
    lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('federal_votes_session_number_idx').on(t.session, t.number),
    index('federal_votes_date_idx').on(t.date),
    index('federal_votes_bill_id_idx').on(t.billId),
  ]
)

export const federalMpBallots = pgTable(
  'federal_mp_ballots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    voteId: uuid('vote_id')
      .notNull()
      .references(() => federalVotes.id, { onDelete: 'cascade' }),
    mpId: uuid('mp_id')
      .notNull()
      .references(() => federalMps.id, { onDelete: 'cascade' }),
    ballot: mpBallotEnum('ballot').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('federal_mp_ballots_vote_mp_idx').on(t.voteId, t.mpId),
    index('federal_mp_ballots_mp_id_idx').on(t.mpId),
  ]
)

export const mpVotingPatterns = pgTable(
  'mp_voting_patterns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mpId: uuid('mp_id')
      .notNull()
      .references(() => federalMps.id, { onDelete: 'cascade' }),
    session: text('session').notNull(),
    patternAnalysis: text('pattern_analysis').notNull(),
    contradictions: jsonb('contradictions'),
    promptVersion: text('prompt_version').notNull(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('mp_voting_patterns_mp_session_idx').on(t.mpId, t.session),
  ]
)

export const postalCodeCache = pgTable(
  'postal_code_cache',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postalCode: text('postal_code').notNull().unique(),
    mpId: uuid('mp_id').references(() => federalMps.id, {
      onDelete: 'set null',
    }),
    ridingName: text('riding_name'),
    metadata: jsonb('metadata'),
    cachedAt: timestamp('cached_at').defaultNow().notNull(),
  },
  (t) => [index('postal_code_cache_postal_code_idx').on(t.postalCode)]
)

export const parliamentSyncLog = pgTable(
  'parliament_sync_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    syncType: text('sync_type').notNull(),
    session: text('session'),
    recordsFetched: integer('records_fetched'),
    recordsUpserted: integer('records_upserted'),
    errors: jsonb('errors'),
    durationMs: integer('duration_ms'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('parliament_sync_log_type_idx').on(t.syncType),
    index('parliament_sync_log_started_at_idx').on(t.startedAt),
  ]
)

export const investigationVotes = pgTable(
  'investigation_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    voteId: uuid('vote_id')
      .notNull()
      .references(() => federalVotes.id, { onDelete: 'cascade' }),
    relevanceExplanation: text('relevance_explanation'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('investigation_votes_inv_vote_idx').on(
      t.investigationId,
      t.voteId
    ),
    index('investigation_votes_investigation_idx').on(t.investigationId),
  ]
)

// --- Feedback Table (Wave 5) ---

export const feedbackTypeEnum = pgEnum('feedback_type', ['bug', 'suggestion'])

export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable: captures the user if authenticated; null if the row is submitted
    // without a valid user context (shouldn't happen given auth gate, but safe).
    // onDelete: 'cascade' — when a user is deleted their feedback rows are removed.
    // Column stays nullable for anonymous rows (no user context at submit time).
    // FK enforced via 0006 migration; the cascade is DB-level, not application-level.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    feedbackType: feedbackTypeEnum('feedback_type').notNull(),
    description: text('description').notNull(),
    // pageContext: the route pathname the user was on when submitting (nullable).
    pageContext: text('page_context'),
    // status: triage state for future admin tooling. Default 'new'.
    status: text('status').notNull().default('new'),
    // timestamptz — timezone-aware, consistent with the tz fix applied in W3.
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('feedback_user_id_idx').on(t.userId),
    index('feedback_type_idx').on(t.feedbackType),
    index('feedback_status_idx').on(t.status),
    index('feedback_created_at_idx').on(t.createdAt),
  ]
)
