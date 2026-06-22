-- Migration: Add generation_started_at to investigations
-- Durable briefing generation (background function decoupling)
-- Created: 2026-06-21
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Safe to re-run.

ALTER TABLE investigations
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz;

-- Backfill: rows that already completed (or are in any terminal state) use
-- created_at as a conservative proxy for when generation started.
-- This prevents the scheduled reaper from immediately sweeping old rows
-- that predate this migration.
UPDATE investigations
  SET generation_started_at = created_at
  WHERE generation_started_at IS NULL;
