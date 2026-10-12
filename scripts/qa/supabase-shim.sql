-- Supabase prerequisites for the local QA harness.
--
-- Run ONCE per fresh database, as the container superuser, BEFORE any
-- migration (scripts/qa/harness.ts pipes it into psql inside the postgres
-- container). Idempotent, so a re-run is harmless.
--
-- Why: drizzle/DR.md says plain PostgreSQL is not enough for the custom
-- migrations. Their RLS policies call auth.uid() and their GRANTs name
-- service_role. Migration 0002 runs CREATE EXTENSION vector, which needs a
-- superuser, and the migrations run as qa_app (NOSUPERUSER).
--
-- Nothing here is a credential worth protecting: qa_app's password is a
-- dummy that only ever opens the disposable database on 127.0.0.1:55432.

\set ON_ERROR_STOP on

-- 1. The Supabase API roles the migrations GRANT to. NOLOGIN, as on Supabase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END
$$;

-- 2. The application role. Production's app role has BYPASSRLS, which is why
--    RLS is structurally inert there (DECISIONS: "RLS is structurally inert").
--    qa_app matches that privilege model: it owns the tables, runs the
--    migrations and serves the app, and it is NOT a superuser. Ownership tests
--    therefore exercise application code, and cannot pass because the
--    database itself blocked access.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_app') THEN
    CREATE ROLE qa_app LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE
      PASSWORD 'qa_app_dummy';
  END IF;
END
$$;
ALTER ROLE qa_app LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- qa_app owns the public schema, so drizzle-kit push can create enums and
-- tables there (PostgreSQL 15+ no longer grants CREATE on public to PUBLIC).
ALTER SCHEMA public OWNER TO qa_app;
GRANT CONNECT, TEMPORARY ON DATABASE republic_qa TO qa_app;

-- 3. The auth schema and auth.uid().
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO qa_app, anon, authenticated, service_role;

-- auth.uid(): the definition Supabase ships, copied verbatim from
--   https://github.com/supabase/postgres/blob/142c6a2c6cb589e66ae9647e868fa428d20fbda5/migrations/db/init-scripts/00000000000001-auth-schema.sql
--   (supabase/postgres, branch develop, commit 142c6a2c6cb589e66ae9647e868fa428d20fbda5,
--    read 2026-10-11; lines 93-96 of that file).
-- The app never sets request.jwt.claim.sub, so this returns NULL for every
-- harness connection, as it does for the production app's connection.
-- Gets the User ID from the request cookie
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

GRANT EXECUTE ON FUNCTION auth.uid() TO qa_app, anon, authenticated, service_role;

-- 4. pgvector, as the superuser. Migration 0002's CREATE EXTENSION IF NOT
--    EXISTS then finds it present and does nothing; qa_app could not create it.
CREATE EXTENSION IF NOT EXISTS vector;
