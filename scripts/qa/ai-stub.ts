/**
 * AI stub for the QA harness: a tiny server that speaks the Anthropic Messages
 * API (streaming and non-streaming) and serves recorded synthetic responses
 * from tests/fixtures/letters.ts. The app reaches it through
 * ANTHROPIC_BASE_URL=http://127.0.0.1:58080/v1, which @ai-sdk/anthropic
 * honours, with a dummy ANTHROPIC_API_KEY. No real model call is possible:
 * the stub answers every request itself and never forwards anything.
 *
 * Model endpoint:
 *   POST /v1/messages        the Messages API. Requests carrying any other
 *                            x-api-key than the harness dummy get 401.
 *
 * Control endpoints (for the harness and the race tests):
 *   GET  /__qa/health        {"ok":true}
 *   GET  /__qa/requests      every request received, in order
 *   POST /__qa/scenario      {"letter":"marker-v1"|"missing-marker"|"double-marker"}
 *                            the letter served to FIPPA generations from now on
 *   POST /__qa/hold          {"count":n} (default 1): the next n streams pause
 *                            after their first text delta until released
 *   GET  /__qa/held          ids of streams currently held
 *   POST /__qa/release       {"id":n} releases one held stream; {} releases all
 *   POST /__qa/reset         clears requests, holds and the scenario
 *
 * Binds 127.0.0.1 only. Run by scripts/qa/harness.ts with `env -i`.
 */

import * as http from 'node:http'
import * as path from 'node:path'
import * as url from 'node:url'
import {
  AI_STUB_LETTERS,
  AI_STUB_MIRROR_TEXT,
  AI_STUB_GENERIC_TEXT,
  type AiStubLetterScenario,
} from '../../tests/fixtures/letters'

export const AI_STUB_HOST = '127.0.0.1'
export const AI_STUB_PORT = 58080

export interface RecordedRequest {
  seq: number
  at: string
  method: string
  path: string
  apiKeyMatched: boolean
  anthropicVersion: string | null
  kind: 'letter' | 'mirror' | 'generic' | 'rejected'
  stream: boolean
  body: unknown
}

type MessageContent = string | Array<{ type?: string; text?: string }>

interface MessagesBody {
  model?: string
  stream?: boolean
  system?: MessageContent
  messages?: Array<{ role?: string; content?: MessageContent }>
}

function textOf(content: MessageContent | undefined): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('\n')
  return ''
}

function classify(body: MessagesBody): 'letter' | 'mirror' | 'generic' {
  const firstUser = textOf(body.messages?.find((m) => m.role === 'user')?.content)
  // The generate route's user message starts "Generate a FIPPA Request."
  if (firstUser.startsWith('Generate a FIPPA Request')) return 'letter'
  // The Mirror compare route's user message starts with the policy question.
  if (firstUser.startsWith('Policy question to compare')) return 'mirror'
  return 'generic'
}

function chunk(text: string, size = 48): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out.length > 0 ? out : ['']
}

function sse(res: http.ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function createAiStub(expectedApiKey: string) {
  const requests: RecordedRequest[] = []
  let seq = 0
  let letterScenario: AiStubLetterScenario = 'marker-v1'
  let holdsPending = 0
  const held = new Map<number, () => void>()
  let holdSeq = 0

  function readJson(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const parts: Buffer[] = []
      req.on('data', (c: Buffer) => parts.push(c))
      req.on('end', () => {
        const raw = Buffer.concat(parts).toString('utf8')
        if (!raw) return resolve({})
        try {
          resolve(JSON.parse(raw))
        } catch (err) {
          reject(err)
        }
      })
      req.on('error', reject)
    })
  }

  function json(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  async function handleMessages(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body: MessagesBody
    try {
      body = (await readJson(req)) as MessagesBody
    } catch {
      return json(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'invalid JSON' } })
    }
    const apiKeyMatched = req.headers['x-api-key'] === expectedApiKey
    const record: RecordedRequest = {
      seq: ++seq,
      at: new Date().toISOString(),
      method: req.method ?? '',
      path: req.url ?? '',
      apiKeyMatched,
      anthropicVersion: (req.headers['anthropic-version'] as string | undefined) ?? null,
      kind: apiKeyMatched ? classify(body) : 'rejected',
      stream: body.stream === true,
      body,
    }
    requests.push(record)
    console.log(`[ai-stub] #${record.seq} ${record.kind} stream=${record.stream}`)

    if (!apiKeyMatched) {
      return json(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'QA stub: unexpected API key' } })
    }

    const text =
      record.kind === 'letter'
        ? AI_STUB_LETTERS[letterScenario]
        : record.kind === 'mirror'
          ? AI_STUB_MIRROR_TEXT
          : AI_STUB_GENERIC_TEXT
    const model = body.model ?? 'qa-stub'
    const id = `msg_qa_${record.seq}`
    const usage = { input_tokens: 1, output_tokens: Math.max(1, Math.ceil(text.length / 4)) }

    if (!record.stream) {
      return json(res, 200, {
        id,
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage,
      })
    }

    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    sse(res, 'message_start', {
      type: 'message_start',
      message: { id, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
    })
    sse(res, 'content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })

    const pieces = chunk(text)
    sse(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: pieces[0] } })

    if (holdsPending > 0) {
      holdsPending--
      const holdId = ++holdSeq
      console.log(`[ai-stub] holding stream ${holdId} (request #${record.seq})`)
      await new Promise<void>((resolve) => held.set(holdId, resolve))
      held.delete(holdId)
      console.log(`[ai-stub] released stream ${holdId}`)
    }

    for (const piece of pieces.slice(1)) {
      sse(res, 'content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })
    }
    sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
    sse(res, 'message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } })
    sse(res, 'message_stop', { type: 'message_stop' })
    res.end()
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const pathname = new URL(req.url ?? '/', `http://${AI_STUB_HOST}`).pathname
    if (req.method === 'POST' && pathname === '/v1/messages') return handleMessages(req, res)
    if (req.method === 'GET' && pathname === '/__qa/health') return json(res, 200, { ok: true })
    if (req.method === 'GET' && pathname === '/__qa/requests') return json(res, 200, { requests })
    if (req.method === 'GET' && pathname === '/__qa/held') return json(res, 200, { held: [...held.keys()] })
    if (req.method === 'POST' && pathname === '/__qa/scenario') {
      const body = (await readJson(req)) as { letter?: string }
      if (!body.letter || !(body.letter in AI_STUB_LETTERS)) {
        return json(res, 400, { error: `letter must be one of ${Object.keys(AI_STUB_LETTERS).join(', ')}` })
      }
      letterScenario = body.letter as AiStubLetterScenario
      return json(res, 200, { letter: letterScenario })
    }
    if (req.method === 'POST' && pathname === '/__qa/hold') {
      const body = (await readJson(req)) as { count?: number }
      const count = Number.isInteger(body.count) && (body.count as number) > 0 ? (body.count as number) : 1
      holdsPending += count
      return json(res, 200, { holdsPending })
    }
    if (req.method === 'POST' && pathname === '/__qa/release') {
      const body = (await readJson(req)) as { id?: number }
      const ids = body.id !== undefined ? [body.id] : [...held.keys()]
      const released: number[] = []
      for (const id of ids) {
        const release = held.get(id)
        if (release) {
          release()
          released.push(id)
        }
      }
      if (body.id !== undefined && released.length === 0) return json(res, 404, { error: `no held stream ${body.id}` })
      return json(res, 200, { released })
    }
    if (req.method === 'POST' && pathname === '/__qa/reset') {
      requests.length = 0
      letterScenario = 'marker-v1'
      holdsPending = 0
      for (const release of held.values()) release()
      return json(res, 200, { ok: true })
    }
    return json(res, 404, { error: `QA stub: no route for ${req.method} ${pathname}` })
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[ai-stub] handler error:', err)
      if (!res.headersSent) json(res, 500, { error: 'QA stub handler error' })
      else res.end()
    })
  })
}

function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !apiKey.startsWith('qa-dummy-')) {
    throw new Error('ANTHROPIC_API_KEY must be the harness dummy (qa-dummy-...); refusing to start')
  }
  const server = createAiStub(apiKey)
  server.listen(AI_STUB_PORT, AI_STUB_HOST, () => {
    console.log(`[ai-stub] listening on http://${AI_STUB_HOST}:${AI_STUB_PORT}`)
  })
  // Held streams keep their sockets open; drop them so close() can finish.
  const stop = () => {
    server.closeAllConnections()
    server.close(() => process.exit(0))
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

if (process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (err) {
    console.error(`ai-stub failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
