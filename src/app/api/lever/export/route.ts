import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { renderLeverPdf, hasLeverPdfTemplate } from '@/lib/pdf/render'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'
import { loadRecipientResolution } from '@/lib/lever/load-recipient'

/**
 * A PDF that takes longer than this is abandoned (A4): the citizen gets a 503
 * and a way out, never an empty or half-written file.
 */
const PDF_RENDER_TIMEOUT_MS = 8_000
const PDF_UNAVAILABLE = "The PDF couldn't be made right now. Use Print or Plain text instead."

class PdfTimeout extends Error {}

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'fippa-request',
  public_comment: 'public-comment',
  policy_brief: 'policy-brief',
}

/**
 * POST /api/lever/export
 * Returns the action content as a downloadable file.
 *
 * Body: { actionId: string, format?: 'txt' | 'md' | 'pdf' }
 * - txt (default): plain text
 * - md: the stored text, byte for byte, as a .md file
 * - pdf: Rendered PDF using @react-pdf/renderer templates. The whole file is
 *   rendered before anything is sent; past PDF_RENDER_TIMEOUT_MS the route
 *   answers 503 with PDF_UNAVAILABLE instead.
 */
export const POST = safeRoute(async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`lever-export:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { actionId: string; format?: 'txt' | 'md' | 'pdf' }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { actionId, format = 'txt' } = body
  if (!actionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionId)) {
    return new Response(JSON.stringify({ error: 'Valid actionId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (format !== 'txt' && format !== 'md' && format !== 'pdf') {
    return new Response(JSON.stringify({ error: 'format must be "txt", "md", or "pdf"' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  const [action] = await db
    .select({
      id: leverActions.id,
      title: leverActions.title,
      actionType: leverActions.actionType,
      content: leverActions.content,
      status: leverActions.status,
      metadata: leverActions.metadata,
      investigationId: leverActions.investigationId,
      createdAt: leverActions.createdAt,
    })
    .from(leverActions)
    .where(and(eq(leverActions.id, actionId), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    return new Response(JSON.stringify({ error: 'Action not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!action.content) {
    return new Response(JSON.stringify({ error: 'Action has no content to export' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const date = new Date(action.createdAt).toISOString().slice(0, 10)
  const typeSlug = ACTION_TYPE_LABELS[action.actionType] ?? 'action'

  // PDF format
  if (format === 'pdf') {
    if (!hasLeverPdfTemplate(action.actionType)) {
      return new Response(
        JSON.stringify({
          error: `PDF export is not available for action type: ${action.actionType}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const metadata = (action.metadata ?? {}) as Record<string, unknown>
    // The recipient block on a FIPPA guidance page (filings design §3): the
    // resolver's answer with the action's own investigation.
    const recipient =
      action.actionType === 'fippa_request'
        ? await loadRecipientResolution(db, { metadata, investigationId: action.investigationId }, userId)
        : undefined

    try {
      const pdf = await withTimeout(
        (async () =>
          drain(
            await renderLeverPdf({
              title: action.title,
              content: action.content,
              actionType: action.actionType,
              metadata,
              status: action.status,
              recipient,
            })
          ))(),
        PDF_RENDER_TIMEOUT_MS
      )
      const filename = `${typeSlug}-${date}.pdf`

      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdf.length),
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      if (err instanceof PdfTimeout) {
        // Logged with identifiers only. The render itself can't be cancelled;
        // it finishes in the background and its result is dropped.
        console.error(
          JSON.stringify({
            event: 'lever.export.pdf_timeout',
            actionId: action.id,
            timeoutMs: PDF_RENDER_TIMEOUT_MS,
            ts: new Date().toISOString(),
          })
        )
        return new Response(JSON.stringify({ error: PDF_UNAVAILABLE }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '30' },
        })
      }
      console.error('[lever/export] PDF render failed:', err)
      return new Response(
        JSON.stringify({
          error: 'PDF rendering failed',
          details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : 'Unknown error') : undefined,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Markdown, as written: the stored text byte for byte (filings §0). The menu
  // labels it "Markdown (as written)"; nothing is added around it.
  if (format === 'md') {
    return new Response(action.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${typeSlug}-${date}.md"`,
      },
    })
  }

  // Default: plain text
  const filename = `${typeSlug}-${date}.txt`
  return new Response(action.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

/** Read a Node stream to the end. */
async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

/** The work's result, or a PdfTimeout rejection once `ms` has passed. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PdfTimeout(`PDF render exceeded ${ms}ms`)), ms)
  })
  // A render that fails after the timeout has already answered must not
  // surface as an unhandled rejection.
  work.catch(() => {})
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}
