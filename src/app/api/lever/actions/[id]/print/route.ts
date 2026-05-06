import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { esc, errorPage, PRINT_CSP } from '@/lib/campaign/print-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeRoute } from '@/lib/api/safe-route'

interface RouteContext {
  params: Promise<{ id: string }>
}

const ACTION_TYPE_DISPLAY: Record<string, string> = {
  fippa_request: 'Freedom of Information Request',
  public_comment: 'Public Comment Submission',
  policy_brief: 'Policy Brief',
  legal_template: 'Legal Template',
  media_spec: 'Media Specification',
  talking_points: 'Talking Points',
  coalition_template: 'Coalition Template',
  mp_letter: 'Letter to Member of Parliament',
}

/**
 * GET /api/lever/actions/[id]/print
 * Returns a print-ready HTML page for a lever action.
 */
export const GET = safeRoute(async (request: NextRequest, { params }: RouteContext) => {
  const printHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': PRINT_CSP,
  }

  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(errorPage('Unauthorized'), {
      status: 401,
      headers: printHeaders,
    })
  }

  const { success } = await checkRateLimit(`lever-print:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params
  const db = getDb()

  const [action] = await db
    .select()
    .from(leverActions)
    .where(and(eq(leverActions.id, id), eq(leverActions.userId, userId)))
    .limit(1)

  if (!action) {
    return new Response(errorPage('Action not found'), {
      status: 404,
      headers: printHeaders,
    })
  }

  if (!action.content) {
    return new Response(errorPage('Action has no content'), {
      status: 422,
      headers: printHeaders,
    })
  }

  const typeLabel = ACTION_TYPE_DISPLAY[action.actionType] ?? action.actionType
  const date = new Date(action.createdAt).toISOString().slice(0, 10)
  const metadata = (action.metadata ?? {}) as Record<string, unknown>
  const publicBody = (metadata.publicBody as string) ?? ''
  const addressee = (metadata.addressee as string) ?? ''

  const bodyHtml = renderActionBody(action.actionType, action.content, {
    date,
    publicBody,
    addressee,
  })

  const html = printPage({
    title: action.title,
    typeLabel,
    date,
    bodyHtml,
  })

  return new Response(html, {
    status: 200,
    headers: printHeaders,
  })
})

// ---------------------------------------------------------------------------
// Action type renderers
// ---------------------------------------------------------------------------

function renderActionBody(
  actionType: string,
  content: string,
  ctx: { date: string; publicBody: string; addressee: string }
): string {
  switch (actionType) {
    case 'fippa_request':
      return renderFippaRequest(content, ctx)
    case 'public_comment':
      return renderPublicComment(content, ctx)
    case 'policy_brief':
      return renderPolicyBrief(content)
    default:
      return renderGenericAction(content)
  }
}

function renderFippaRequest(
  content: string,
  ctx: { date: string; publicBody: string; addressee: string }
): string {
  const lines: string[] = []

  // Formal letter layout
  lines.push('<div class="letter">')

  // Date
  lines.push(`<p class="letter-date">${esc(ctx.date)}</p>`)

  // Addressee
  if (ctx.addressee || ctx.publicBody) {
    lines.push('<div class="letter-addressee">')
    if (ctx.addressee) lines.push(`<p>${esc(ctx.addressee)}</p>`)
    if (ctx.publicBody) lines.push(`<p>${esc(ctx.publicBody)}</p>`)
    lines.push('</div>')
  }

  // Body
  lines.push('<div class="letter-body">')
  // Split content by double-newlines for paragraph separation
  const paragraphs = content.split(/\n\n+/)
  paragraphs.forEach((p) => {
    const trimmed = p.trim()
    if (trimmed) {
      lines.push(`<p>${esc(trimmed)}</p>`)
    }
  })
  lines.push('</div>')

  // Signature placeholder
  lines.push('<div class="signature">')
  lines.push('<p>Sincerely,</p>')
  lines.push('<div class="signature-line"></div>')
  lines.push('<p class="signature-label">[Name]</p>')
  lines.push('</div>')

  lines.push('</div>')
  return lines.join('\n')
}

function renderPublicComment(
  content: string,
  ctx: { date: string; publicBody: string }
): string {
  const lines: string[] = []

  lines.push('<div class="formal-submission">')

  if (ctx.publicBody) {
    lines.push(`<p class="submission-to">Submitted to: ${esc(ctx.publicBody)}</p>`)
  }
  lines.push(`<p class="submission-date">Date: ${esc(ctx.date)}</p>`)

  lines.push('<div class="submission-body">')
  const paragraphs = content.split(/\n\n+/)
  paragraphs.forEach((p, i) => {
    const trimmed = p.trim()
    if (trimmed) {
      lines.push(`<p><span class="para-number">${i + 1}.</span> ${esc(trimmed)}</p>`)
    }
  })
  lines.push('</div>')

  lines.push('</div>')
  return lines.join('\n')
}

function renderPolicyBrief(content: string): string {
  const lines: string[] = []

  lines.push('<div class="policy-brief">')

  // Try to detect section headers (lines ending with colon or all-caps lines)
  const rawLines = content.split('\n')
  let inSection = false

  rawLines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inSection) lines.push('')
      return
    }

    // Detect section headers: lines that look like headers
    // (all caps, or ending with colon, or starting with a number followed by a period and uppercase)
    const isHeader = /^[A-Z][A-Z\s]{3,}$/.test(trimmed) || /^\d+\.\s+[A-Z]/.test(trimmed)

    if (isHeader) {
      lines.push(`<h3 class="brief-section">${esc(trimmed)}</h3>`)
      inSection = true
    } else {
      lines.push(`<p>${esc(trimmed)}</p>`)
      inSection = true
    }
  })

  lines.push('</div>')
  return lines.join('\n')
}

function renderGenericAction(content: string): string {
  const paragraphs = content.split(/\n\n+/)
  return paragraphs
    .map((p) => {
      const trimmed = p.trim()
      return trimmed ? `<p>${esc(trimmed)}</p>` : ''
    })
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// HTML shell
// ---------------------------------------------------------------------------

function printPage(opts: {
  title: string
  typeLabel: string
  date: string
  bodyHtml: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)} -- The Republic</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 1.7;
    color: #1c1917;
    background: #fafaf9;
    padding: 2rem;
  }

  .page {
    max-width: 800px;
    margin: 0 auto;
  }

  /* Print button */
  .print-btn {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 500;
    padding: 8px 16px;
    background: #C85B5B;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    z-index: 100;
  }
  .print-btn:hover { opacity: 0.9; }

  /* Header */
  .header {
    margin-bottom: 2.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid #C85B5B;
  }
  .wordmark {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C85B5B;
    margin-bottom: 1rem;
  }
  .doc-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #C85B5B;
    margin-bottom: 0.25rem;
  }
  .doc-title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 24px;
    line-height: 1.3;
    color: #1c1917;
  }
  .doc-date {
    font-size: 12px;
    color: #78716c;
    margin-top: 0.5rem;
  }

  /* Letter (FIPPA) */
  .letter { padding-top: 1rem; }
  .letter-date { margin-bottom: 1.5rem; font-weight: 500; }
  .letter-addressee { margin-bottom: 2rem; line-height: 1.5; color: #44403c; }
  .letter-body p { margin-bottom: 1rem; }
  .signature { margin-top: 3rem; }
  .signature p { margin-bottom: 0.25rem; }
  .signature-line { width: 200px; border-bottom: 1px solid #1c1917; margin: 2rem 0 0.5rem; }
  .signature-label { font-size: 12px; color: #78716c; }

  /* Formal submission (public comment) */
  .formal-submission { padding-top: 1rem; }
  .submission-to { font-weight: 500; margin-bottom: 0.25rem; }
  .submission-date { font-size: 13px; color: #78716c; margin-bottom: 2rem; }
  .submission-body p { margin-bottom: 1rem; }
  .para-number { font-weight: 500; color: #C85B5B; margin-right: 0.5rem; }

  /* Policy brief */
  .policy-brief p { margin-bottom: 0.75rem; }
  .brief-section {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #C85B5B;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(200, 91, 91, 0.2);
  }

  /* Footer */
  .footer {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid #e7e5e4;
    font-size: 11px;
    color: #a8a29e;
    text-align: center;
  }

  /* Print styles */
  @media print {
    body { padding: 0; background: white; }
    .print-btn { display: none; }
    .page { max-width: none; }
    .letter, .formal-submission, .policy-brief { page-break-inside: avoid; }
    .header { border-bottom-color: #C85B5B; }
    @page { margin: 1in; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print</button>
<div class="page">
  <div class="header">
    <p class="wordmark">THE REPUBLIC</p>
    <p class="doc-label">${esc(opts.typeLabel)}</p>
    <h1 class="doc-title">${esc(opts.title)}</h1>
    <p class="doc-date">${esc(opts.date)}</p>
  </div>

  ${opts.bodyHtml}

  <div class="footer">
    Generated from The Republic &mdash; opencave.ca
  </div>
</div>
</body>
</html>`
}
