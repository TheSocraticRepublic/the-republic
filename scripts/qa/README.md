# Local QA harness

A disposable, production-mode copy of Open Cave on your own machine, for
authenticated evidence: signed-in pages, ownership checks, letter rendering,
generation races. Its database, Redis and AI model are local; it holds no real
API key and never uses the auth bypass. It is NOT network-isolated: see
"Outbound network" below for exactly what can still leave the machine.

Nothing in this directory ships. `next build` type-checks it, and that is all
it does to the app.

## Use

From a worktree that has no `.env*` files (only `.env.example`), after `npm ci`:

```bash
npx tsx scripts/qa/harness.ts run                 # up, every Q0b check, tear down
npx tsx scripts/qa/harness.ts up                  # start and supervise (Ctrl-C, SIGTERM or SIGHUP stops it)
npx tsx scripts/qa/harness.ts check               # the Q0b checks, against a running harness
npx tsx scripts/qa/harness.ts down                # stop everything, remove the database volume
```

Every `up` and `run` builds (`next build`) under its own `env -i`. There is no
reuse option: a `.next` built any other way (a plain `npm run build` carries
the shell's environment, including any `NEXT_PUBLIC_*` it inlines) is never
served.

Teardown stops only what that invocation started. A refused `up` ("already
running", a port in use) starts nothing and stops nothing. The compose project
is `open-cave-qa-<hash>`, scoped to the worktree like the state directory, so
`down` in one worktree can't remove another worktree's stack; the ports are
still shared, so only one worktree's harness can run at a time. `down` signals
a recorded pid only after its start time and command line show it is still the
harness's process.

`up` needs at least 4000 MB of available memory (it checks before starting the
stack and again before `next build`) and ports 55432, 58079, 58080 and 3177 free
on 127.0.0.1. Logs and state live in `$TMPDIR/open-cave-qa-<hash>/`
(`harness.log`, `server.log`, `ai-stub.log`).

The `.next` directory the harness builds has `NEXT_PUBLIC_APP_URL` set to
`http://127.0.0.1:3177`. Run `npm run build` again before any other use of that
build.

## What runs

| Piece | Where | Notes |
|---|---|---|
| Postgres 17 + pgvector | `127.0.0.1:55432`, database `republic_qa` | `docker-compose.qa.yml`, image pinned by digest |
| Redis 7 + an Upstash-compatible REST proxy | `127.0.0.1:58079` | the production rate limiter fails closed without it |
| AI stub (`ai-stub.ts`) | `127.0.0.1:58080` | speaks the Anthropic Messages API; serves fixtures |
| The app, `next build && next start` | `127.0.0.1:3177` | `NODE_ENV=production` |

Every container port binds `127.0.0.1` only.

## The order `up` follows

1. **Preflight.** Refuses if any `.env*` file other than `.env.example` is in the
   repo root (Next.js would load it into the server; the harness lists the names
   and never reads them), if a harness is already running, if a port is taken,
   or if memory is short. A refusal changes nothing.
2. **Services.** `docker compose -p open-cave-qa-<hash> up -d --wait`, with an
   empty variables file so compose never reads a repo `.env`.
3. **Supabase shim** (`supabase-shim.sql`), as the container superuser: roles
   `anon`, `authenticated`, `service_role`; the application role `qa_app`
   (LOGIN, BYPASSRLS, NOSUPERUSER), which owns the tables like the production
   app role; schema `auth` with Supabase's own `auth.uid()` (source URL and
   commit in the file); and `CREATE EXTENSION vector`, which `qa_app` cannot run.
4. **Migrations**, as `qa_app`: `drizzle-kit push`, then
   `scripts/apply-custom-migrations.ts`. All fourteen must be recorded in
   `_custom_migrations`, or `up` stops.
5. **Seed** (`seed-local.ts`).
6. **Build**, then the AI stub and `next start`.
7. **Readiness.** `/api/health` must answer 200 `{"status":"ok"}`. That route
   runs a database query through the app's `getDb()`, which is where the
   local-only TLS rule fires, and a real Redis round-trip. Then an authenticated,
   database-backed route (`GET /api/lever/actions` as user A) must return A's
   25 seeded actions. An open port is never treated as ready.

## Isolation

- **`env -i` for every process.** Each process the harness launches gets
  `/usr/bin/env -i` plus an explicit allow-list of harness values, per process:
  the database writers get only the database variables, the stub gets only its
  dummy key, and so on. The launch lines (variable names only) are in
  `harness.log`, and `check` reads `/proc/<pid>/environ` of the running server
  and stub to prove they hold exactly their allow-list.
- **The writer guard.** Before every database writer (drizzle-kit, the custom
  runner, `seed-local`), the harness runs `assertLocalQaTargets()` from
  `scripts/lib/local-db-guard.ts` against exactly the environment that writer
  will receive. It checks both the effective migration URL
  (`DIRECT_DATABASE_URL`, falling back to `DATABASE_URL`) and `DATABASE_URL`:
  loopback host, port 55432, database name ending `_qa`. `seed-local` runs the
  same guard again inside itself.
- **drizzle-kit and dotenv.** drizzle-kit 0.31 loads `./.env` (or
  `DOTENV_CONFIG_PATH`) when it starts, before `drizzle.config.ts` reads its URL.
  Every writer therefore gets `DIRECT_DATABASE_URL` set explicitly to the guarded
  local URL (dotenv never overrides a variable that is already set) and a
  `DOTENV_CONFIG_PATH` that does not exist. `DOTENV_CONFIG_OVERRIDE` is never
  passed.
- **TLS.** The harness Postgres has no TLS. TLS is off only because
  `QA_LOCAL_DB=1` and the host is `127.0.0.1`; the same flag with any other host
  throws (Q0a's rule in `src/lib/db/index.ts` and `scripts/lib/supabase-ssl.ts`).
- **Dummies.** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, the Redis token and the
  internal trigger secret are fixed dummies. `JWT_SECRET` is random per run and
  starts with `qa-harness-jwt-`; `mint-session.ts` refuses any secret without
  that prefix. `DEV_AUTH_BYPASS` is never set.

## Production-mode constraints

- **Origin.** The middleware rejects a state-changing request whose `Origin`
  isn't `NEXT_PUBLIC_APP_URL`. The harness sets it to `http://127.0.0.1:3177`,
  so every non-browser POST, PUT, PATCH or DELETE (API tests, race tests) must
  send `Origin: http://127.0.0.1:3177`. `harness.ts` routes all its own requests
  through `appRequest()`, which adds it for every method but GET. A 403 from a
  missing Origin is a harness bug, not a finding.
- **Secure cookie.** `verify-code` sets the session cookie with `secure: true`.
  Chromium sends Secure cookies to `http://127.0.0.1` (loopback is a secure
  context), so all signed-in browser evidence runs in Chromium on `127.0.0.1`.
  WebKit does not; a WebKit run must add a minted cookie to the browser context
  directly and prove it took effect with a 200 on `/investigate` before any
  check counts.

## Sessions

```bash
# inside the harness's environment (harness.ts does this for its checks):
tsx --conditions=react-server scripts/qa/mint-session.ts --user a [--netscape cookies.txt]
```

`mint-session.ts` signs a session with the harness `JWT_SECRET` through the
app's own `src/lib/auth/jwt.ts` and prints a cookie object (the shape
Playwright's `context.addCookies()` takes). `--netscape` also writes a curl
cookie file. `--conditions=react-server` is needed because `jwt.ts` imports
`server-only`.

Login is tested for real: `seed-local.ts --login-code` stores the hash of a
known code for user A, and the browser check types it into `/login`. The
login page's first step POSTs `/api/auth/send-code`; the harness never lets
that reach the server (it would try to send email), so the browser check
answers that one request itself, through `interceptSendCode(context)` from
`scripts/qa/browser.ts`, installed on the browser context before any page
opens. Any later browser test on the harness must import it from that module
(it has no side effects on import) and install it the same way. `verify-code`, the cookie
and the redirect are the real ones.

## The AI stub

`ai-stub.ts` answers `POST /v1/messages` (streaming or not) with fixtures from
`tests/fixtures/letters.ts`, and refuses any API key but the harness dummy.

| Endpoint | Does |
|---|---|
| `GET /__qa/requests` | every request received, with its body |
| `POST /__qa/scenario` `{"letter": "marker-v1" \| "missing-marker" \| "double-marker"}` | the letter FIPPA generations get from now on (default `marker-v1`) |
| `POST /__qa/hold` `{"count": n}` | the next n streams pause after their first chunk |
| `GET /__qa/held`, `POST /__qa/release` `{"id": n}` or `{}` | list or release held streams |
| `POST /__qa/reset` | clear requests, holds and the scenario |

A Mirror comparison request gets a short synthetic comparison; anything else
gets a one-line synthetic reply.

## The seed

All synthetic, from `tests/fixtures/letters.ts` unless noted:

- users A (`qa-owner-a@example.test`, the owner) and B (`qa-other-b@example.test`),
  each with a profile and display name;
- A's completed investigation, with the synthetic briefing (`SEEDED_BRIEFING`);
- for A, one FIPPA action per seeded letter fixture (legacy, marker-v1,
  ambiguous, missing marker, placeholder, literal-marker, Other body, unresolved
  jurisdiction) in each of draft, final and filed (24), plus one public comment;
- one public comment owned by B, so "B can't see A's actions" is tested against
  a non-empty list;
- an Oracle document with an analysis, and a Gadfly session with three turns;
- the Mirror's reference jurisdictions from `data/seeds/jurisdictions.json`
  (the repo's own data). A Mirror comparison can't be seeded: the app has no
  table for comparisons and streams each one on demand. The populated `/mirror`
  state is therefore a live request through the AI stub, and `check` exercises
  exactly that (`POST /api/mirror/compare` as A, with the seeded document, must
  return the stub's synthetic comparison and be recorded as a Mirror request);
- two real House of Commons divisions, 45-1 #177 and #178, with both bills,
  all 337 current MPs and every ballot. Source URLs are in `seed-local.ts`, and
  the seed refuses to run if the ballots stop reproducing the official totals.

## Outbound network (a named fidelity limit)

The harness cannot sandbox the network: that needs root or user namespaces,
and this host's kernel denies `unshare -Ur`. So `next build` and `next start`
have the machine's network. The database, Redis and the AI model are local
by construction (fixed loopback URLs, dummy keys, `ANTHROPIC_BASE_URL` on the
stub). What can still leave the machine, and what it carries:

| Destination | When | What it receives |
|---|---|---|
| Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | every `next build` (`next/font/google` in `src/app/layout.tsx`) | font requests only |
| Sentry's build tooling | `next build` (`withSentryConfig` in `next.config.ts`); not verified whether it sends anything with no auth token, org or project set | build metadata at most; the harness sets no DSN, so the running app sends no events |
| Represent API (`represent.opennorth.ca`) | postal-code lookup and investigation creation (`src/lib/parliament/represent.ts`) | the synthetic postal code a test enters |
| openparliament.ca API | parliament sync, MP pattern and contradiction routes (`src/lib/parliament/client.ts`) | public identifiers; the project's User-Agent |
| DuckDuckGo (`duck-duck-scrape`) | Scout discovery and briefing generation search (`src/lib/scout/search.ts`, `src/lib/ai/search-context.ts`) | the synthetic query or concern text |
| Resend (`api.resend.com`) | only if a browser or API test reaches `/api/auth/send-code` without `interceptSendCode` | the synthetic address, with the dummy key (rejected) |
| Any user-supplied URL | Oracle or Scout URL ingestion, archive re-ingest | whatever a test submits |

Pinata and Arweave stay off (`PINATA_JWT` unset, `ENABLE_ARWEAVE` unset).

Only synthetic data may ever be sent to any of these. And **no batch's
evidence may depend on an outbound call succeeding.** A check that creates an
investigation, looks up an MP or searches must either stub that dependency or
assert only on behaviour that holds when the call fails; a third-party outage
must never turn a harness check red or green.

## What the harness does not prove

It proves application behaviour under production settings, not hosting
behaviour. Netlify's function runtime, its CDN and the placement of edge
middleware are not reproduced; the post-deploy probes cover those.

If the harness can't produce authenticated evidence for a batch, that batch
stops. Signed-out evidence never stands in for signed-in evidence.

## Tearing down

`down` (or Ctrl-C, SIGTERM or SIGHUP on `up` or `run`) stops the server and the
stub and runs `docker compose -p open-cave-qa-<hash> down -v`, which deletes
the database volume. Nothing persists between runs.
