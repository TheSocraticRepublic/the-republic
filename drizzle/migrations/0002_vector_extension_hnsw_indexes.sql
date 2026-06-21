-- Migration: pgvector extension + HNSW similarity indexes
-- Created: 2026-06-20
-- WARNING: Do NOT run this migration without review. Apply manually.
--
-- Strategy:
--   1. Ensure the pgvector extension is present (idempotent; it is already
--      installed on prod as v0.8.0, created out-of-band).
--   2. Create HNSW indexes for cosine-distance similarity search on both
--      vector-embedding columns.
--
-- These statements exactly match what MARVIN already created on prod
-- (2026-06-20 probe confirmed both indexes exist). Re-applying is a no-op
-- thanks to IF NOT EXISTS guards. Safe on both fresh and existing DBs.
--
-- Vector dimensions: 1024 (voyage-4-lite embeddings)
-- Operator class: vector_cosine_ops — matches the <=> queries in
--   src/lib/ai/search-chunks.ts (lines 101, 112)
--
-- HNSW vs IVFFlat: HNSW was chosen for sub-millisecond recall without
-- needing a training phase (IVFFlat requires CLUSTER/VACUUM after bulk load).
-- Default m=16, ef_construction=64 are Supabase defaults and appropriate
-- for this dataset size.

-- ============================================================================
-- 1. VECTOR EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. HNSW INDEX — document_chunks
-- ============================================================================

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- 3. HNSW INDEX — jurisdiction_policies
-- ============================================================================

CREATE INDEX IF NOT EXISTS jurisdiction_policies_embedding_hnsw_idx
  ON jurisdiction_policies
  USING hnsw (embedding vector_cosine_ops);
