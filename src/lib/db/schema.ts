import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  real,
  jsonb,
  numeric,
  date,
  index,
  boolean,
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
])

// --- Tables ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
})

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('documents_user_id_idx').on(t.userId),
    index('documents_status_idx').on(t.status),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('gadfly_sessions_user_id_idx').on(t.userId),
    index('gadfly_sessions_status_idx').on(t.status),
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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('lever_actions_user_id_idx').on(t.userId),
    index('lever_actions_status_idx').on(t.status),
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
