# Handoff — The Republic / Open Cave

**Session:** session-387576 | **Date:** 2026-08-16 | **Branch:** marvin/session-387576 (at main)

## What shipped this session

### Batch B — Stop the irreversible harm (8 items, all closed)

| ID | Item | Commit(s) |
|----|------|-----------|
| B0 | PDF font vendoring (prior session) | `d25f116` |
| B1 | PRIV-2 — archiver UUID removed from bundle (v1.1) | `c6b8af0`, `5a3fe41` |
| B2 | Consent gate before irreversible preservation | `8e538e1` |
| B3 | Archive FK survivability (migration 0008 applied) | `dd49812`, `d7977c9` |
| B4 | Audit trail survivability (migration 0009 applied) | `4fd70fc` |
| B5 | Supabase Pro deferred — manual pg_dump taken instead | `/tmp/republic-pre-migration-backup-20260813/` |
| B5a | CI credential hardening (TLS + workflow injection) | `7ff7d35` |
| B6 | 7 secrets narrowed to production-only + JWT rotated | Netlify API (no code commit) |

### Batch C — Close the inert controls (7 items, C2 Lee-gated)

| ID | Item | Commit(s) |
|----|------|-----------|
| C1 | Security headers in middleware, CSP Report-Only | `e2fbe8d` |
| C3 | RLS documentation corrected (DR.md) | `bebce26` |
| C4 | Sentry scrubbing — postal code path, IP headers, all 3 runtimes | `7e1584f` |
| C5 | Privacy policy — Open North disclosed, archive/Sentry copy refined | `9b5b0d0`, `68f4dac` |
| C6 | players.description dropped (migration 0010 applied) | `adbe8c1` |
| C7 | credential_events unique index + 19 FK indexes (migration 0011, 1 dedup) | `9c0ea6a`, `8ca7335` |
| C2 | Branch protection | **Lee-gated** (see Standing Gates) |

### Razor reviews: 3 passes, 0 unresolved CRITICALs

- B1 PRIV-2: PASS (1 WARNING fixed — bare `.returning()`)
- B2-B5a batch: PASS (1 WARNING fixed — snapshot columns not consumed by pages)
- Batch C: PASS (1 CRITICAL fixed — `run-briefing.ts` missed `onConflictDoNothing`; 2 WARNINGs fixed — privacy page date + "all US-based")

## Standing Gates

### 1. Branch protection (C2) — Lee's GitHub account

Settings → Branches → Add rule for `main`:
- Required status check: `ci`
- Require up-to-date branches
- Include administrators

Trade-off: every merge goes through a PR. Direct push stops. CI is green on main (`68f4dac`).

### 2. CSP enforce flip — browser walk first

CSP is Report-Only. To enforce:
1. Walk every surface in Chrome DevTools watching for violations:
   - Public: `/`, `/login`, `/foundations`, `/privacy`, `/archive`, `/archive/[id]`, `/u/[name]`
   - Authenticated: `/oracle`, `/investigate`, `/votes`, `/lever`, `/mirror`, `/scout`
   - PDF export (campaign or lever)
2. If zero violations: change `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in `src/middleware.ts:19`
3. Known wrinkle: print pages (`print-utils.ts`) still reference Google Fonts — needs fixing before or alongside the enforce flip

### 3. Supabase Pro (deferred, not blocking)

Citizen data has no automated backup or PITR. Manual dump taken for the migrations. Pro (~$25/mo) is the right fix before real users. The pseudonymous account is `thesocraticrepublic@proton.me` on Supabase (project `gtctqrniggcbmyyrsrnk`, us-east-2).

## Open Questions

- **Migrations 0010/0011 applied directly** (not via the runner). If the runner is re-run, it will re-apply them idempotently (all use `IF NOT EXISTS` / `IF EXISTS` guards).
- **JWT rotation took effect** with the Batch C deploy. All existing sessions invalidated.
- **Deploy previews are now static-only** — all 7 secrets narrowed to production context. Fork PRs cannot exfiltrate credentials.

## What's next (per the issue register)

1. **Section D/E triage** — ~28 Fable/Opus findings never severity-rated against the code. **BUG-F2** (bill summaries from title-only metadata) is the highest-priority civic-honesty item.
2. **Section A remaining** — 5 live unowned items (R-A3 through R-A7): unthrottled profile write, tie-as-defeated, API errors as empty states, MP letter IDOR, dead lens panel.
3. **Section F** — forum pre-launch list (gated behind `FORUM_ENABLED`).
4. **Batch D candidates** — performance (revalidate, prompt caching, RAG race), Node 20 EOL, Sentry source maps, safeRoute sweep.

## Source of truth

`~/marvin/state/the-republic-issue-register.md` — every finding deduplicated across all sources. The ROADMAP `next` field points there.
