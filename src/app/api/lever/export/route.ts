import { NextRequest } from 'next/server'
import { Readable } from 'stream'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { renderLeverPdf, hasLeverPdfTemplate } from '@/lib/pdf/render'

const ACTION_TYPE_LABELS: Record<string, string> = {
  fippa_request: 'fippa-request',
  public_comment: 'public-comment',
  policy_brief: 'policy-brief',
}

const ACTION_TYPE_DISPLAY: Record<string, string> = {
  fippa_request: 'FOI Request (FIPPA)',
  public_comment: 'Public Comment',
  policy_brief: 'Policy Brief',
  legal_template: 'Legal Template',
  media_spec: 'Media Specification',
  talking_points: 'Talking Points',
  coalition_template: 'Coalition Template',
  mp_letter: 'Letter to MP',
}

/**
 * POST /api/lever/export
 * Returns the action content as a downloadable file.
 *
 * Body: { actionId: string, format?: 'txt' | 'md' | 'pdf' }
 * - txt (default): plain text
 * - md: Markdown with YAML frontmatter and section headers
 * - pdf: Rendered PDF using @react-pdf/renderer templates
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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

    try {
      const nodeStream = await renderLeverPdf({
        title: action.title,
        content: action.content,
        actionType: action.actionType,
        metadata: (action.metadata ?? {}) as Record<string, unknown>,
      })

      const webStream = nodeReadableToWebReadable(nodeStream)
      const filename = `${typeSlug}-${date}.pdf`

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
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

  if (format === 'md') {
    const metadata = (action.metadata ?? {}) as Record<string, unknown>
    const publicBody = (metadata.publicBody as string) ?? ''
    const typeDisplay = ACTION_TYPE_DISPLAY[action.actionType] ?? action.actionType

    // Build YAML frontmatter — JSON.stringify produces valid YAML double-quoted strings
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(action.title)}`,
      `type: ${JSON.stringify(typeDisplay)}`,
      `date: ${JSON.stringify(date)}`,
      `status: ${JSON.stringify(action.status)}`,
    ]
    if (publicBody) {
      frontmatter.push(`public_body: ${JSON.stringify(publicBody)}`)
    }
    frontmatter.push('---')

    // Wrap content with section headers based on action type
    const body = formatContentAsMarkdown(action.actionType, action.content, action.title)

    const mdContent = frontmatter.join('\n') + '\n\n' + body + '\n\n---\n\n*Generated by The Republic -- ' + date + '*\n'
    const filename = `${typeSlug}-${date}.md`

    return new Response(mdContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
}

/**
 * Add Markdown section headers to the raw text content based on action type.
 */
function formatContentAsMarkdown(
  actionType: string,
  content: string,
  title: string
): string {
  const lines: string[] = []

  lines.push(`# ${title}`)
  lines.push('')

  switch (actionType) {
    case 'fippa_request':
      lines.push('## Freedom of Information Request')
      lines.push('')
      lines.push(content)
      break
    case 'public_comment':
      lines.push('## Public Comment Submission')
      lines.push('')
      lines.push(content)
      break
    case 'policy_brief':
      lines.push('## Policy Brief')
      lines.push('')
      lines.push(content)
      break
    default:
      lines.push(content)
      break
  }

  return lines.join('\n')
}

/**
 * Convert a Node.js ReadableStream to a Web ReadableStream for Next.js Response.
 */
function nodeReadableToWebReadable(
  nodeStream: NodeJS.ReadableStream
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        controller.enqueue(
          chunk instanceof Buffer ? new Uint8Array(chunk) : new TextEncoder().encode(chunk as string)
        )
      })
      nodeStream.on('end', () => {
        controller.close()
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
      })
    },
    cancel() {
      if ('destroy' in nodeStream && typeof nodeStream.destroy === 'function') {
        ;(nodeStream as Readable).destroy()
      }
    },
  })
}
