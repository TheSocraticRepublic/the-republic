/**
 * The local QA harness: a disposable production-mode stack for authenticated
 * evidence, with no production credentials and no auth bypass.
 *
 *   npx tsx scripts/qa/harness.ts up      start, then supervise until Ctrl-C, SIGTERM, SIGHUP or `down`
 *   npx tsx scripts/qa/harness.ts check                run the Q0b checks against a running stack
 *   npx tsx scripts/qa/harness.ts run     up, check, tear down, in one process
 *   npx tsx scripts/qa/harness.ts down                 stop everything and remove the volume
 *
 * What `up` does, in order (scripts/qa/README.md has the why):
 *   1. preflight: no .env* file but .env.example in the repo; ports 55432,
 *      58079, 58080 and 3177 free; at least 4000 MB of memory available;
 *   2. `docker compose -f docker-compose.qa.yml up -d --wait`;
 *   3. scripts/qa/supabase-shim.sql, as the container superuser;
 *   4. drizzle-kit push, then scripts/apply-custom-migrations.ts (all 14 must
 *      be recorded in _custom_migrations), then scripts/qa/seed-local.ts;
 *   5. `next build`, every run, under its own `env -i` (memory re-checked
 *      first). A `.next` from anywhere else is never served;
 *   6. the AI stub on 127.0.0.1:58080 and `next start` on 127.0.0.1:3177;
 *   7. readiness: /api/health answers 200 "ok" (a database- and Redis-backed
 *      route), and an authenticated, database-backed API route returns A's
 *      seeded actions. "The port is open" is never treated as ready.
 *
 * Isolation. Every process the harness launches (the database writers, the
 * build, the server, the stub, the session minter) is started as
 * `/usr/bin/env -i KEY=value ... command`, with an explicit per-process
 * allow-list of harness values. Nothing is inherited from the shell or from
 * any .env file. Before every database writer the harness runs
 * assertLocalQaTargets() against EXACTLY the environment that writer will get,
 * and each writer also gets an explicit DIRECT_DATABASE_URL (the guarded
 * local URL) and a DOTENV_CONFIG_PATH that does not exist, so drizzle-kit's
 * startup dotenv load cannot supply a different database URL.
 *
 * The harness itself only talks to 127.0.0.1 and to the docker daemon.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'
import { assertLocalQaTargets } from '../lib/local-db-guard'
import { QA_JWT_SECRET_PREFIX, QA_LOGIN_CODE, QA_USER_A, QA_USER_B } from './seed-local'
import { AI_STUB_LETTERS, AI_STUB_MIRROR_TEXT } from '../../tests/fixtures/letters'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Fixed harness values. All dummies; none of them opens anything but this
// disposable local stack.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.qa.yml')
const SHIM_FILE = path.join(REPO_ROOT, 'scripts', 'qa', 'supabase-shim.sql')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'drizzle', 'migrations')

const STATE_DIR = path.join(
  os.tmpdir(),
  `open-cave-qa-${createHash('sha1').update(REPO_ROOT).digest('hex').slice(0, 10)}`
)
const STATE_FILE = path.join(STATE_DIR, 'state.json')
const HARNESS_LOG = path.join(STATE_DIR, 'harness.log')
/**
 * The compose project, scoped to this worktree like STATE_DIR, so a `down` in
 * one worktree can never remove another worktree's stack.
 */
const COMPOSE_PROJECT = path.basename(STATE_DIR)
/** An empty variables file for docker compose, so it never reads a repo .env. */
const COMPOSE_VARS = path.join(STATE_DIR, 'compose-vars-empty')
/** DOTENV_CONFIG_PATH for every child. It must never exist. */
const MISSING_DOTENV = path.join(STATE_DIR, 'no-such-directory', 'dotenv-file-that-does-not-exist')

const QA_DATABASE_URL = 'postgres://qa_app:qa_app_dummy@127.0.0.1:55432/republic_qa'
const APP_HOST = '127.0.0.1'
const APP_PORT = 3177
const APP_URL = `http://${APP_HOST}:${APP_PORT}`
const REDIS_REST_URL = 'http://127.0.0.1:58079'
const AI_STUB_URL = 'http://127.0.0.1:58080'
const PORTS = [55432, 58079, 58080, APP_PORT]
const MIN_AVAILABLE_MB = 4000
const EXPECTED_CUSTOM_MIGRATIONS = 14
/** 8 letter fixtures x 3 statuses, plus one public comment (seed-local.ts). */
const EXPECTED_A_ACTIONS = 25

const NODE = process.execPath
const TSX = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const NEXT = path.join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next')
const DRIZZLE_KIT = path.join(REPO_ROOT, 'node_modules', 'drizzle-kit', 'bin.cjs')

function harnessValues(jwtSecret: string): Record<string, string> {
  return {
    PATH: `${path.dirname(NODE)}:/usr/bin:/bin`,
    HOME: path.join(STATE_DIR, 'home'),
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    QA_LOCAL_DB: '1',
    DATABASE_URL: QA_DATABASE_URL,
    // W2: explicit, so a dotenv file can never supply a different one
    // (dotenv does not override a variable that is already set).
    DIRECT_DATABASE_URL: QA_DATABASE_URL,
    DOTENV_CONFIG_PATH: MISSING_DOTENV,
    JWT_SECRET: jwtSecret,
    NEXT_PUBLIC_APP_URL: APP_URL,
    UPSTASH_REDIS_REST_URL: REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: 'qa_redis_token_dummy',
    ANTHROPIC_API_KEY: 'qa-dummy-anthropic-key',
    ANTHROPIC_BASE_URL: `${AI_STUB_URL}/v1`,
    RESEND_API_KEY: 'qa-dummy-resend-key',
    RESEND_FROM_EMAIL: 'qa-harness@example.test',
    INTERNAL_TRIGGER_SECRET: 'qa-dummy-internal-trigger-secret',
    FORUM_ENABLED: 'false',
  }
}

/** Database writers: drizzle-kit, the custom runner, seed-local. */
const WRITER_KEYS = ['PATH', 'HOME', 'NODE_ENV', 'QA_LOCAL_DB', 'DATABASE_URL', 'DIRECT_DATABASE_URL', 'DOTENV_CONFIG_PATH']
/** `next build` and `next start`. No DIRECT_DATABASE_URL: the app never reads it. */
const APP_KEYS = [
  'PATH',
  'HOME',
  'NODE_ENV',
  'NEXT_TELEMETRY_DISABLED',
  'QA_LOCAL_DB',
  'DATABASE_URL',
  'DOTENV_CONFIG_PATH',
  'JWT_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'INTERNAL_TRIGGER_SECRET',
  'FORUM_ENABLED',
]
const STUB_KEYS = ['PATH', 'HOME', 'NODE_ENV', 'ANTHROPIC_API_KEY']
const MINT_KEYS = ['PATH', 'HOME', 'NODE_ENV', 'QA_LOCAL_DB', 'JWT_SECRET', 'NEXT_PUBLIC_APP_URL']

// ---------------------------------------------------------------------------
// Logging and small helpers
// ---------------------------------------------------------------------------

function log(message: string): void {
  const line = `[harness] ${message}`
  console.log(line)
  try {
    fs.appendFileSync(HARNESS_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // The state directory may not exist yet (first lines of `up`); the line
    // was still printed to stdout, so nothing is lost from view.
  }
}

function fail(message: string): never {
  throw new Error(message)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pick(values: Record<string, string>, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of keys) {
    if (values[k] === undefined) fail(`harness bug: no value for allow-listed variable ${k}`)
    out[k] = values[k]
  }
  return out
}

function availableMemoryMb(): number {
  const meminfo = fs.readFileSync('/proc/meminfo', 'utf8')
  const match = meminfo.match(/^MemAvailable:\s+(\d+) kB$/m)
  if (!match) fail('could not read MemAvailable from /proc/meminfo')
  return Math.floor(Number(match[1]) / 1024)
}

function requireMemory(before: string): void {
  const mb = availableMemoryMb()
  log(`memory before ${before}: ${mb} MB available (minimum ${MIN_AVAILABLE_MB})`)
  if (mb < MIN_AVAILABLE_MB) fail(`deferred: memory (${mb} MB available before ${before}, need ${MIN_AVAILABLE_MB})`)
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

// ---------------------------------------------------------------------------
// Launching: always `env -i` with an explicit allow-list
// ---------------------------------------------------------------------------

function envArgv(env: Record<string, string>, command: string[]): string[] {
  return ['-i', ...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...command]
}

function describeLaunch(label: string, env: Record<string, string>, command: string[]): void {
  // Names only: values include the per-run JWT secret.
  const shown = command.map((c) => path.relative(REPO_ROOT, c).startsWith('..') ? c : path.relative(REPO_ROOT, c) || c)
  log(`launch ${label}: /usr/bin/env -i ${Object.keys(env).join(' ')} -- ${shown.join(' ')}`)
}

function launch(label: string, env: Record<string, string>, command: string[], logFile: string): ChildProcess {
  describeLaunch(label, env, command)
  const fd = fs.openSync(logFile, 'a')
  const child = spawn('/usr/bin/env', envArgv(env, command), {
    cwd: REPO_ROOT,
    // The spawned /usr/bin/env gets nothing; `-i` then clears even that.
    env: {} as NodeJS.ProcessEnv,
    stdio: ['ignore', fd, fd],
    // Its own process group, so teardown can stop it AND everything it forks
    // (next build's workers survive a signal to the parent alone).
    detached: true,
  })
  fs.closeSync(fd)
  return child
}

/** Short-lived children (writers, build, mint) still running; a signal must stop them too. */
const inFlight = new Set<ChildProcess>()

function runToCompletion(
  label: string,
  env: Record<string, string>,
  command: string[],
  opts: { capture?: boolean } = {}
): Promise<string> {
  describeLaunch(label, env, command)
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/env', envArgv(env, command), {
      cwd: REPO_ROOT,
      // The spawned /usr/bin/env gets nothing; `-i` then clears even that.
      env: {} as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Own process group; see launch().
      detached: true,
    })
    inFlight.add(child)
    child.on('exit', () => inFlight.delete(child))
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString()
      if (!opts.capture) process.stdout.write(d.toString().replace(/^(?=.)/gm, `  ${label} | `))
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
      process.stderr.write(d.toString().replace(/^(?=.)/gm, `  ${label} ! `))
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`${label} exited ${code}${opts.capture ? `: ${stderr.trim().split('\n').slice(-5).join(' / ')}` : ''}`))
    })
  })
}

/**
 * W1/W2: judge the guard against EXACTLY the environment the writer gets,
 * not the harness's own process.env.
 */
function guardWriter(label: string, env: Record<string, string>): void {
  const saved = process.env
  process.env = { ...env } as NodeJS.ProcessEnv
  try {
    assertLocalQaTargets()
  } catch (err) {
    fail(`${label} refused by the local-db guard: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    process.env = saved
  }
  if (env.QA_LOCAL_DB !== '1') fail(`${label} refused: QA_LOCAL_DB is not 1`)
  if (env.DIRECT_DATABASE_URL !== env.DATABASE_URL) fail(`${label} refused: DIRECT_DATABASE_URL must equal the guarded DATABASE_URL`)
  if (fs.existsSync(env.DOTENV_CONFIG_PATH)) fail(`${label} refused: DOTENV_CONFIG_PATH ${env.DOTENV_CONFIG_PATH} exists`)
  log(`guard passed for ${label}: assertLocalQaTargets() on its environment, explicit DIRECT_DATABASE_URL, absent DOTENV_CONFIG_PATH`)
}

async function runWriter(label: string, values: Record<string, string>, command: string[]): Promise<string> {
  const env = pick(values, WRITER_KEYS)
  guardWriter(label, env)
  return runToCompletion(label, env, command)
}

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

function compose(args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('docker', ['compose', '-p', COMPOSE_PROJECT, '--env-file', COMPOSE_VARS, '-f', COMPOSE_FILE, ...args], {
    cwd: REPO_ROOT,
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** Read-only query as the container superuser, inside the container. */
function psql(sql: string): string {
  const r = compose(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'republic_qa', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql])
  if (r.status !== 0) fail(`psql failed: ${r.stderr.trim()}`)
  return r.stdout.trim()
}

function composeDown(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  if (!fs.existsSync(COMPOSE_VARS)) fs.writeFileSync(COMPOSE_VARS, '')
  log(`docker compose -p ${COMPOSE_PROJECT} down -v`)
  const r = compose(['down', '-v'])
  process.stdout.write(r.stderr.replace(/^(?=.)/gm, '  compose | '))
  if (r.status !== 0) log(`compose down exited ${r.status}`)
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface HarnessState {
  supervisorPid: number
  serverPid: number
  stubPid: number
  /** /proc/<pid>/stat start times, so a reused pid is never mistaken for ours. */
  supervisorStart: string
  serverStart: string
  stubStart: string
  jwtSecret: string
  startedAt: string
}

function writeState(state: HarnessState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 })
}

function readState(): HarnessState | null {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as HarnessState
  } catch {
    return null
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Field 22 of /proc/<pid>/stat (start time in clock ticks since boot), or null if the pid is gone. */
function procStartTime(pid: number): string | null {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    // The command name (field 2) may contain spaces; fields after it follow the last ')'.
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19] ?? null
  } catch {
    return null
  }
}

function procCmdline(pid: number): string {
  try {
    return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim()
  } catch {
    return ''
  }
}

/**
 * W1: a recorded pid is ours only if it is alive, its start time is the one
 * recorded when the harness launched it, and its command line still looks
 * like what was launched. Anything else is a reused pid and is never signalled.
 */
function ownedPid(pid: number, start: string | undefined, cmdlineMarkers: string[]): { owned: boolean; why: string } {
  if (!pid || !pidAlive(pid)) return { owned: false, why: 'not running' }
  const actualStart = procStartTime(pid)
  if (!start || actualStart !== start) return { owned: false, why: `start time ${actualStart} != recorded ${start}` }
  const cmd = procCmdline(pid)
  if (!cmdlineMarkers.some((m) => cmd.includes(m))) return { owned: false, why: `command line "${cmd.slice(0, 80)}" is not the harness's` }
  return { owned: true, why: 'start time and command line match' }
}

const SERVER_MARKERS = ['next-server', 'next/dist/bin/next']
const STUB_MARKERS = ['scripts/qa/ai-stub.ts']
const SUPERVISOR_MARKERS = ['scripts/qa/harness.ts']

// ---------------------------------------------------------------------------
// HTTP helpers (loopback only)
// ---------------------------------------------------------------------------

/**
 * Every non-browser request to the app goes through here. N2: the middleware
 * rejects a state-changing request (POST, PUT, PATCH, DELETE) whose Origin is
 * not NEXT_PUBLIC_APP_URL, so those always carry it. A 403 from a missing
 * Origin would be a harness bug, never a finding.
 */
async function appRequest(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  pathname: string,
  opts: { cookie?: string; json?: unknown } = {}
): Promise<Response> {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  if (method !== 'GET') headers.origin = APP_URL
  if (opts.json !== undefined) headers['content-type'] = 'application/json'
  return fetch(`${APP_URL}${pathname}`, {
    method,
    redirect: 'manual',
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  })
}

function httpGet(pathname: string, cookie?: string): Promise<Response> {
  return appRequest('GET', pathname, { cookie })
}

/**
 * W3: no browser the harness drives may reach send-code (it would call Resend
 * with the dummy key and the synthetic address). Installed on the CONTEXT, so
 * it covers every page in it. Exported for later batches' browser tests.
 */
export async function interceptSendCode(context: import('playwright').BrowserContext): Promise<{ count: number }> {
  const counter = { count: 0 }
  await context.route('**/api/auth/send-code', async (route) => {
    counter.count++
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  return counter
}

async function mintCookie(values: Record<string, string>, user: 'a' | 'b'): Promise<{ header: string; json: Record<string, unknown> }> {
  const out = await runToCompletion(
    `mint-session ${user}`,
    pick(values, MINT_KEYS),
    [NODE, TSX, '--conditions=react-server', path.join(REPO_ROOT, 'scripts', 'qa', 'mint-session.ts'), '--user', user],
    { capture: true }
  )
  const json = JSON.parse(out.trim().split('\n').pop() as string) as { name: string; value: string }
  return { header: `${json.name}=${json.value}`, json }
}

async function waitFor(label: string, timeoutMs: number, probe: () => Promise<string | null>): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let last = 'no attempt yet'
  while (Date.now() < deadline) {
    try {
      const failure = await probe()
      if (failure === null) return
      last = failure
    } catch (err) {
      last = err instanceof Error ? err.message : String(err)
    }
    await sleep(1000)
  }
  fail(`${label} not ready after ${timeoutMs / 1000}s: ${last}`)
}

function tail(file: string, lines = 40): string {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return '(no log)'
  }
}

// ---------------------------------------------------------------------------
// up
// ---------------------------------------------------------------------------

interface Running {
  values: Record<string, string>
  server: ChildProcess
  stub: ChildProcess
}

async function preflight(): Promise<void> {
  // .env files: Next.js and drizzle-kit load them on their own. Refuse rather
  // than read or work around them. Names only are listed; contents never read.
  const envFiles = fs.readdirSync(REPO_ROOT).filter((f) => f.startsWith('.env') && f !== '.env.example')
  if (envFiles.length > 0) {
    fail(
      `refusing to start: ${envFiles.join(', ')} present in ${REPO_ROOT}. Next.js would load it into the server. ` +
        'Run the harness from a worktree with no .env files.'
    )
  }
  const live = readState()
  if (live && ownedPid(live.supervisorPid, live.supervisorStart, SUPERVISOR_MARKERS).owned) {
    // W1: refuse and touch nothing. This invocation started nothing, so its
    // teardown has nothing to stop.
    fail(`a harness is already running (supervisor pid ${live.supervisorPid}); run \`down\` first`)
  }
  for (const port of PORTS) {
    if (!(await portIsFree(port))) fail(`port 127.0.0.1:${port} is in use; run \`down\` or free it first`)
  }
  for (const bin of [TSX, NEXT, DRIZZLE_KIT]) {
    if (!fs.existsSync(bin)) fail(`${path.relative(REPO_ROOT, bin)} is missing; run npm ci first`)
  }
  if (fs.existsSync(MISSING_DOTENV)) fail(`${MISSING_DOTENV} exists; it must not`)
}

/**
 * W1: what THIS invocation started. Teardown stops exactly these and nothing
 * else: a refused `up` (already running, port taken) starts nothing, so it
 * tears nothing down.
 */
const started: { compose: boolean; server?: ChildProcess; stub?: ChildProcess; stateWritten: boolean } = {
  compose: false,
  stateWritten: false,
}

async function bringUp(): Promise<Running> {
  fs.mkdirSync(path.join(STATE_DIR, 'home'), { recursive: true, mode: 0o700 })
  fs.writeFileSync(COMPOSE_VARS, '')
  await preflight()
  // Only now is the log ours to truncate; a refused `up` leaves the live one alone.
  fs.writeFileSync(HARNESS_LOG, '')

  const values = harnessValues(`${QA_JWT_SECRET_PREFIX}${randomBytes(24).toString('hex')}`)
  if ('DEV_AUTH_BYPASS' in values) fail('DEV_AUTH_BYPASS must never be set')
  if (values.NODE_ENV !== 'production') fail('NODE_ENV must be production')

  requireMemory('starting the stack')
  log(`docker compose -p ${COMPOSE_PROJECT} up -d --wait`)
  started.compose = true
  const up = compose(['up', '-d', '--wait'])
  process.stdout.write(up.stderr.replace(/^(?=.)/gm, '  compose | '))
  if (up.status !== 0) fail('docker compose up failed')

  if (psql("select count(*) from pg_tables where schemaname = 'public'") !== '0') {
    fail('the QA database is not fresh; run `down` (which removes the volume) and start again')
  }

  log('applying scripts/qa/supabase-shim.sql as the container superuser')
  const shim = compose(
    ['exec', '-T', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'republic_qa', '-f', '-'],
    fs.readFileSync(SHIM_FILE, 'utf8')
  )
  process.stdout.write(shim.stdout.replace(/^(?=.)/gm, '  shim | '))
  if (shim.status !== 0) fail(`supabase shim failed: ${shim.stderr.trim()}`)

  await runWriter('drizzle-kit push', values, [NODE, DRIZZLE_KIT, 'push', '--force'])
  await runWriter('custom migrations', values, [NODE, TSX, path.join(REPO_ROOT, 'scripts', 'apply-custom-migrations.ts')])

  const expected = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^0+\d+_.+\.sql$/.test(f)).sort()
  const recorded = psql('select filename from _custom_migrations order by filename').split('\n').filter(Boolean)
  if (expected.length !== EXPECTED_CUSTOM_MIGRATIONS || recorded.join('\n') !== expected.join('\n')) {
    fail(`_custom_migrations records ${recorded.length} of ${expected.length} migration files: ${recorded.join(', ')}`)
  }
  log(`all ${recorded.length} custom migrations recorded in _custom_migrations`)

  await runWriter('seed-local', values, [NODE, TSX, path.join(REPO_ROOT, 'scripts', 'qa', 'seed-local.ts')])

  // W2: always build, under this run's own env -i. A `.next` built by anything
  // else (a plain `npm run build` with the shell's environment) is never served.
  requireMemory('next build')
  await runToCompletion('next build', pick(values, APP_KEYS), [NODE, NEXT, 'build'])

  const stub = launch('ai-stub', pick(values, STUB_KEYS), [NODE, TSX, path.join(REPO_ROOT, 'scripts', 'qa', 'ai-stub.ts')], path.join(STATE_DIR, 'ai-stub.log'))
  started.stub = stub
  await waitFor('AI stub', 30_000, async () => {
    const r = await fetch(`${AI_STUB_URL}/__qa/health`)
    return r.ok ? null : `HTTP ${r.status}`
  })
  log('AI stub ready on 127.0.0.1:58080')

  const serverLog = path.join(STATE_DIR, 'server.log')
  const server = launch(
    'next start',
    pick(values, APP_KEYS),
    [NODE, NEXT, 'start', '-p', String(APP_PORT), '-H', APP_HOST],
    serverLog
  )
  started.server = server

  // N3: ready means a database-backed route answers correctly. /api/health
  // runs `select 1` through getDb() (which is where the TLS rule fires) and a
  // real Redis round-trip, and returns 200 only when both are ok.
  try {
    await waitFor('/api/health', 90_000, async () => {
      const r = await httpGet('/api/health')
      const body = await r.text()
      return r.status === 200 && JSON.parse(body).status === 'ok' ? null : `HTTP ${r.status} ${body}`
    })
    log('/api/health answered 200 {"status":"ok"}')
    const a = await mintCookie(values, 'a')
    const r = await httpGet('/api/lever/actions', a.header)
    const body = (await r.json()) as { actions?: unknown[] }
    if (r.status !== 200 || body.actions?.length !== EXPECTED_A_ACTIONS) {
      fail(`authenticated readiness probe: GET /api/lever/actions as A gave HTTP ${r.status} with ${body.actions?.length} actions (expected ${EXPECTED_A_ACTIONS})`)
    }
    log(`authenticated readiness probe: GET /api/lever/actions as A returned ${EXPECTED_A_ACTIONS} actions`)
  } catch (err) {
    console.error(`--- last lines of ${serverLog} ---\n${tail(serverLog)}`)
    throw err
  }

  writeState({
    supervisorPid: process.pid,
    serverPid: server.pid as number,
    stubPid: stub.pid as number,
    supervisorStart: procStartTime(process.pid) ?? '',
    serverStart: procStartTime(server.pid as number) ?? '',
    stubStart: procStartTime(stub.pid as number) ?? '',
    jwtSecret: values.JWT_SECRET,
    startedAt: new Date().toISOString(),
  })
  started.stateWritten = true
  log(`ready: app ${APP_URL}, AI stub ${AI_STUB_URL}, database 127.0.0.1:55432, redis REST ${REDIS_REST_URL}`)
  log(`logs and state in ${STATE_DIR}`)
  return { values, server, stub }
}

interface Target {
  label: string
  pid: number
}

/** Every process the harness launches leads its own process group (pgid = pid). */
function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

async function signalAndWait(targets: Target[]): Promise<void> {
  for (const t of targets) {
    log(`stopping ${t.label} (process group ${t.pid})`)
    try {
      process.kill(-t.pid, 'SIGTERM')
    } catch {
      // Already gone between the ownership check and the signal.
    }
  }
  const deadline = Date.now() + 15_000
  while (targets.some((t) => groupAlive(t.pid)) && Date.now() < deadline) await sleep(250)
  for (const t of targets) {
    if (groupAlive(t.pid)) {
      log(`${t.label} (process group ${t.pid}) ignored SIGTERM; sending SIGKILL`)
      try {
        process.kill(-t.pid, 'SIGKILL')
      } catch {
        // Already gone.
      }
    }
  }
}

/**
 * Tear down exactly what this invocation started. The server and stub are
 * this process's own children (unreaped, so their pids cannot have been
 * reused); compose is downed only if this invocation brought it up.
 */
async function teardownStarted(): Promise<void> {
  const targets: Target[] = []
  for (const [label, child] of [['next start', started.server], ['ai-stub', started.stub]] as const) {
    if (child?.pid && child.exitCode === null && child.signalCode === null) targets.push({ label, pid: child.pid })
  }
  for (const child of inFlight) {
    if (child.pid && child.exitCode === null && child.signalCode === null) targets.push({ label: 'in-flight step', pid: child.pid })
  }
  await signalAndWait(targets)
  if (started.compose) composeDown()
  if (started.stateWritten) fs.rmSync(STATE_FILE, { force: true })
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string
  pass: boolean
  evidence: string[]
}

function environKeys(pid: number): string[] {
  return fs
    .readFileSync(`/proc/${pid}/environ`, 'utf8')
    .split('\0')
    .filter(Boolean)
    .map((kv) => kv.slice(0, kv.indexOf('=')))
    .sort()
}

function environValue(pid: number, key: string): string | undefined {
  const entry = fs
    .readFileSync(`/proc/${pid}/environ`, 'utf8')
    .split('\0')
    .find((kv) => kv.startsWith(`${key}=`))
  return entry?.slice(key.length + 1)
}

function processTree(rootPid: number): string {
  const r = spawnSync('ps', ['-eo', 'pid,ppid,args', '--forest'], { encoding: 'utf8' })
  const rows = r.stdout.split('\n')
  const header = rows[0]
  const byPid = new Map<number, number>()
  for (const row of rows.slice(1)) {
    const m = row.trim().match(/^(\d+)\s+(\d+)/)
    if (m) byPid.set(Number(m[1]), Number(m[2]))
  }
  const inTree = (pid: number): boolean => {
    for (let p: number | undefined = pid, guard = 0; p && guard < 64; p = byPid.get(p), guard++) {
      if (p === rootPid) return true
    }
    return false
  }
  return [header, ...rows.slice(1).filter((row) => {
    const m = row.trim().match(/^(\d+)/)
    return m ? inTree(Number(m[1])) : false
  })]
    .map((row) => row.replace(/(JWT_SECRET=)\S+/g, '$1<redacted>').slice(0, 220))
    .join('\n')
}

async function runChecks(values: Record<string, string>, state: HarnessState): Promise<CheckResult[]> {
  const results: CheckResult[] = []
  const record = async (name: string, fn: (evidence: string[]) => Promise<boolean>) => {
    const evidence: string[] = []
    let pass = false
    try {
      pass = await fn(evidence)
    } catch (err) {
      evidence.push(`error: ${err instanceof Error ? err.message : String(err)}`)
    }
    results.push({ name, pass, evidence })
    console.log(`\n${pass ? 'PASS' : 'FAIL'}  ${name}`)
    for (const e of evidence) console.log(`      ${e}`)
  }

  const a = await mintCookie(values, 'a')
  const b = await mintCookie(values, 'b')

  await record('/api/health returns 200 with Postgres and Redis ok, under NODE_ENV=production', async (ev) => {
    const r = await httpGet('/api/health')
    const body = await r.text()
    ev.push(`GET ${APP_URL}/api/health -> HTTP ${r.status} ${body}`)
    ev.push('(the route returns 200 "ok" only when the database probe and the Redis round-trip both pass, and in production a missing Redis is a failure)')
    const nodeEnv = environValue(state.serverPid, 'NODE_ENV')
    const bypass = environValue(state.serverPid, 'DEV_AUTH_BYPASS')
    ev.push(`server pid ${state.serverPid}: NODE_ENV=${nodeEnv}; DEV_AUTH_BYPASS ${bypass === undefined ? 'unset' : `SET (${bypass})`}`)
    return r.status === 200 && JSON.parse(body).status === 'ok' && nodeEnv === 'production' && bypass === undefined
  })

  await record(`all ${EXPECTED_CUSTOM_MIGRATIONS} custom migrations are recorded in _custom_migrations`, async (ev) => {
    const expected = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^0+\d+_.+\.sql$/.test(f)).sort()
    const recorded = psql('select filename from _custom_migrations order by filename').split('\n').filter(Boolean)
    ev.push(`files: ${expected.length}; recorded: ${recorded.length}`)
    ev.push(recorded.join(', '))
    return expected.length === EXPECTED_CUSTOM_MIGRATIONS && recorded.join('\n') === expected.join('\n')
  })

  await record('a minted session for A reaches /investigate (200); with no cookie it redirects to /login', async (ev) => {
    const withCookie = await httpGet('/investigate', a.header)
    ev.push(`GET /investigate with A's minted cookie -> HTTP ${withCookie.status}`)
    const without = await httpGet('/investigate')
    const location = without.headers.get('location') ?? ''
    ev.push(`GET /investigate with no cookie -> HTTP ${without.status} location=${location}`)
    return withCookie.status === 200 && [302, 303, 307, 308].includes(without.status) && new URL(location, APP_URL).pathname === '/login'
  })

  await record("GET /api/lever/actions as B does not list A's actions", async (ev) => {
    const r = await httpGet('/api/lever/actions', b.header)
    const body = (await r.json()) as { actions: Array<{ id: string; title: string }> }
    const seen = new Set(body.actions.map((x) => x.id))
    const aIds = psql(`select id from lever_actions where user_id = '${QA_USER_A.id}'`).split('\n').filter(Boolean)
    const bIds = psql(`select id from lever_actions where user_id = '${QA_USER_B.id}'`).split('\n').filter(Boolean)
    const leaked = aIds.filter((id) => seen.has(id))
    ev.push(`HTTP ${r.status}; B sees ${body.actions.length} action(s): ${body.actions.map((x) => x.title).join(' | ')}`)
    ev.push(`A owns ${aIds.length} actions in the database; ${leaked.length} of them appear in B's list`)
    ev.push(`B owns ${bIds.length} action(s); B's list ${bIds.every((id) => seen.has(id)) && seen.size === bIds.length ? 'is exactly' : 'is NOT exactly'} B's own`)
    return r.status === 200 && leaked.length === 0 && aIds.length === EXPECTED_A_ACTIONS && seen.size === bIds.length && bIds.every((id) => seen.has(id))
  })

  await record('a browser login through verify-code with the seeded code reaches /investigate', async (ev) => {
    await runWriter('seed-local --login-code', values, [NODE, TSX, path.join(REPO_ROOT, 'scripts', 'qa', 'seed-local.ts'), '--login-code'])
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true, env: { HOME: values.HOME, PATH: values.PATH } })
    try {
      const context = await browser.newContext()
      // Before any page exists, so every page and popup in this context is covered.
      const sendCode = await interceptSendCode(context)
      const page = await context.newPage()
      let verifyStatus: number | null = null
      page.on('response', (res) => {
        if (res.url() === `${APP_URL}/api/auth/verify-code`) verifyStatus = res.status()
      })
      await page.goto(`${APP_URL}/login`)
      await page.locator('#email').fill(QA_USER_A.email)
      await page.getByRole('button', { name: 'Send code' }).click()
      await page.locator('#code').fill(QA_LOGIN_CODE)
      await page.getByRole('button', { name: 'Verify code' }).click()
      await page.waitForURL(`${APP_URL}/investigate`, { timeout: 30_000 })
      const reload = await page.goto(`${APP_URL}/investigate`)
      // No URL filter: context.cookies(url) drops Secure cookies for an http
      // URL, although Chromium does send them to loopback.
      const cookies = await context.cookies()
      const auth = cookies.find((c) => c.name === 'republic_token' && c.domain === APP_HOST)
      ev.push(`send-code answered in the browser (never reached the server): ${sendCode.count} time(s)`)
      ev.push(`POST /api/auth/verify-code (real route, through the browser) -> HTTP ${verifyStatus}`)
      ev.push(`browser landed on ${page.url()}; reload -> HTTP ${reload?.status()}`)
      ev.push(`auth cookie set by the server: ${auth ? `republic_token httpOnly=${auth.httpOnly} secure=${auth.secure} sameSite=${auth.sameSite}` : 'MISSING'}`)
      return verifyStatus === 200 && reload?.status() === 200 && page.url() === `${APP_URL}/investigate` && auth?.secure === true
    } finally {
      await browser.close()
    }
  })

  await record('a generation on a seeded draft is served by the AI stub, which records the request', async (ev) => {
    await fetch(`${AI_STUB_URL}/__qa/reset`, { method: 'POST' })
    const actionId = psql(
      `select id from lever_actions where user_id = '${QA_USER_A.id}' and title = 'FIPPA Request: QA marker-v1 (draft)'`
    )
    const r = await appRequest('POST', '/api/lever/generate', { cookie: a.header, json: { actionId } })
    const streamed = await r.text()
    ev.push(`POST /api/lever/generate (Origin: ${APP_URL}) for A's marker-v1 draft ${actionId} -> HTTP ${r.status}, ${streamed.length} characters streamed`)
    const { requests } = (await (await fetch(`${AI_STUB_URL}/__qa/requests`)).json()) as {
      requests: Array<{ path: string; kind: string; apiKeyMatched: boolean; stream: boolean; anthropicVersion: string | null }>
    }
    for (const q of requests) ev.push(`stub recorded: ${q.path} kind=${q.kind} stream=${q.stream} apiKeyMatched=${q.apiKeyMatched} anthropic-version=${q.anthropicVersion}`)
    const matches = streamed === AI_STUB_LETTERS['marker-v1']
    ev.push(`streamed text ${matches ? 'equals' : 'DIFFERS FROM'} the stub's marker-v1 letter`)
    return (
      r.status === 200 &&
      matches &&
      requests.length === 1 &&
      requests[0].path === '/v1/messages' &&
      requests[0].kind === 'letter' &&
      requests[0].apiKeyMatched
    )
  })

  await record('a Mirror comparison is served by the AI stub (Mirror path)', async (ev) => {
    // Comparisons are not stored (no table), so the populated /mirror state is
    // produced on demand. This proves that path reaches the stub, and that the
    // stub recognises it, so a prompt-wording change cannot silently route it
    // to the generic reply.
    await fetch(`${AI_STUB_URL}/__qa/reset`, { method: 'POST' })
    const documentId = psql(`select id from documents where user_id = '${QA_USER_A.id}'`)
    const r = await appRequest('POST', '/api/mirror/compare', {
      cookie: a.header,
      json: { documentId, policyArea: 'environment', description: 'How do other places notify residents before approving logging above a drinking-water intake? (QA)' },
    })
    const streamed = await r.text()
    ev.push(`POST /api/mirror/compare (Origin: ${APP_URL}) as A with the seeded document -> HTTP ${r.status}, ${streamed.length} characters streamed`)
    const { requests } = (await (await fetch(`${AI_STUB_URL}/__qa/requests`)).json()) as {
      requests: Array<{ path: string; kind: string; apiKeyMatched: boolean }>
    }
    for (const q of requests) ev.push(`stub recorded: ${q.path} kind=${q.kind} apiKeyMatched=${q.apiKeyMatched}`)
    const matches = streamed === AI_STUB_MIRROR_TEXT
    ev.push(`streamed text ${matches ? 'equals' : 'DIFFERS FROM'} the stub's synthetic comparison`)
    return r.status === 200 && matches && requests.length === 1 && requests[0].kind === 'mirror' && requests[0].apiKeyMatched
  })

  await record('`env -i` is visible in the launcher\'s process tree', async (ev) => {
    ev.push(`process tree under the supervisor (pid ${state.supervisorPid}):`)
    for (const line of processTree(state.supervisorPid).split('\n')) ev.push(`  ${line}`)
    ev.push('launch lines from the harness log:')
    for (const line of fs.readFileSync(HARNESS_LOG, 'utf8').split('\n').filter((l) => l.includes('launch '))) {
      ev.push(`  ${line.replace(/^\S+ /, '')}`)
    }
    let ok = true
    for (const [label, pid, keys] of [
      ['next start', state.serverPid, APP_KEYS],
      ['ai-stub', state.stubPid, STUB_KEYS],
    ] as const) {
      const actual = environKeys(pid)
      const expected = [...keys].sort()
      const same = actual.join(',') === expected.join(',')
      ok &&= same
      ev.push(`/proc/${pid}/environ (${label}) holds exactly the allow-list: ${same ? 'yes' : 'NO'} [${actual.join(' ')}]`)
    }
    return ok && processTree(state.supervisorPid).includes(String(state.serverPid))
  })

  return results
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * N6: SIGINT, SIGTERM and SIGHUP all tear down exactly what this invocation
 * started (see `started`), in `up` and in `run` alike, then exit.
 */
function onSignalsTearDown(): { stopping: () => boolean; stop: (why: string, code?: number) => Promise<void> } {
  let stopping = false
  const stop = async (why: string, code = 0) => {
    if (stopping) return
    stopping = true
    log(`${why}; tearing down what this invocation started`)
    await teardownStarted()
    process.exit(code)
  }
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => void stop(`${signal} received`, 130))
  }
  return { stopping: () => stopping, stop }
}

async function cmdUp(): Promise<void> {
  const { stopping, stop } = onSignalsTearDown()
  let running: Running
  try {
    running = await bringUp()
  } catch (err) {
    console.error(`[harness] up failed: ${err instanceof Error ? err.message : String(err)}`)
    await stop('up failed', 1)
    return
  }
  log('supervising; Ctrl-C, SIGTERM, SIGHUP or `harness.ts down` stops everything and removes the volume')
  for (const [label, child] of [['next start', running.server], ['ai-stub', running.stub]] as const) {
    child.on('exit', (code, signal) => {
      if (!stopping()) void stop(`${label} exited unexpectedly (code ${code}, signal ${signal})`, 1)
    })
  }
  await new Promise(() => {})
}

async function cmdCheck(): Promise<void> {
  const state = readState()
  if (!state || !ownedPid(state.supervisorPid, state.supervisorStart, SUPERVISOR_MARKERS).owned) {
    fail('no running harness; start one with `up`')
  }
  const values = harnessValues(state.jwtSecret)
  const results = await runChecks(values, state)
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length > 0) process.exit(1)
}

async function cmdRun(): Promise<void> {
  const { stop } = onSignalsTearDown()
  let code = 1
  try {
    const running = await bringUp()
    const results = await runChecks(running.values, readState() as HarnessState)
    const failed = results.filter((r) => !r.pass)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    code = failed.length === 0 ? 0 : 1
  } catch (err) {
    console.error(`[harness] run failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  await stop('run finished', code)
}

/**
 * `down` is for THIS worktree's harness only: the compose project is scoped
 * to the worktree, and a recorded pid is signalled only after its start time
 * and command line prove it is still the harness's process (W1). A pid that
 * fails that test is reported and left alone.
 */
async function cmdDown(): Promise<void> {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  const state = readState()
  if (state) {
    const sup = ownedPid(state.supervisorPid, state.supervisorStart, SUPERVISOR_MARKERS)
    if (sup.owned) {
      log(`signalling supervisor ${state.supervisorPid}`)
      process.kill(state.supervisorPid, 'SIGTERM')
      const deadline = Date.now() + 60_000
      while (pidAlive(state.supervisorPid) && Date.now() < deadline) await sleep(500)
    } else {
      log(`supervisor pid ${state.supervisorPid} not signalled: ${sup.why}`)
    }
    const strays: Target[] = []
    for (const [label, pid, start, markers] of [
      ['next start', state.serverPid, state.serverStart, SERVER_MARKERS],
      ['ai-stub', state.stubPid, state.stubStart, STUB_MARKERS],
    ] as const) {
      const own = ownedPid(pid, start, markers)
      if (own.owned) strays.push({ label, pid })
      else log(`${label} pid ${pid} not signalled: ${own.why}`)
    }
    await signalAndWait(strays)
  }
  composeDown()
  fs.rmSync(STATE_FILE, { force: true })
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  if (rest.length > 0) {
    console.error(`unknown argument(s): ${rest.join(' ')}`)
    process.exit(2)
  }
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
  switch (command) {
    case 'up':
      return cmdUp()
    case 'check':
      return cmdCheck()
    case 'run':
      return cmdRun()
    case 'down':
      return cmdDown()
    default:
      console.error('usage: harness.ts up | check | run | down')
      process.exit(2)
  }
}

main().catch((err) => {
  console.error(`[harness] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
