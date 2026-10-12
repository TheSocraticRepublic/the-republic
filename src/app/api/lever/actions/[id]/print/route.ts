import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { leverActions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { esc, errorPage, PRINT_CSP } from '@/lib/campaign/print-utils'
import { parseLetter, blocksToHtml, escapeHtml, uncleanSplitNotice } from '@/lib/lever/letter-blocks'
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

  const metadata = (action.metadata ?? {}) as Record<string, unknown>

  // A FIPPA request is a filing: the letter stands alone (filings §1, R5), so
  // it gets its own page with no template header, date, addressee, signature
  // or branding. Every other action type keeps the shell below, unchanged.
  if (action.actionType === 'fippa_request') {
    return new Response(fippaPrintPage(action.title, action.content, metadata.letterFormat, action.status), {
      status: 200,
      headers: printHeaders,
    })
  }

  const typeLabel = ACTION_TYPE_DISPLAY[action.actionType] ?? action.actionType
  const date = new Date(action.createdAt).toISOString().slice(0, 10)
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
    case 'public_comment':
      return renderPublicComment(content, ctx)
    case 'policy_brief':
      return renderPolicyBrief(content)
    default:
      return renderGenericAction(content)
  }
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
<title>${esc(opts.title)} -- Open Cave</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
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
    background: #DC2626;
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
    border-bottom: 2px solid #DC2626;
  }
  .wordmark {
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #DC2626;
    margin-bottom: 1rem;
  }
  .doc-label {
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #DC2626;
    margin-bottom: 0.25rem;
  }
  .doc-title {
    font-family: 'Instrument Sans', sans-serif;
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
  .para-number { font-weight: 500; color: #DC2626; margin-right: 0.5rem; }

  /* Policy brief */
  .policy-brief p { margin-bottom: 0.75rem; }
  .brief-section {
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #DC2626;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(220, 38, 38, 0.2);
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
    .header { border-bottom-color: #DC2626; }
    @page { margin: 1in; }
  }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print</button>
<div class="page">
  <div class="header">
    <p class="wordmark">OPEN CAVE</p>
    <p class="doc-label">${esc(opts.typeLabel)}</p>
    <h1 class="doc-title">${esc(opts.title)}</h1>
    <p class="doc-date">${esc(opts.date)}</p>
  </div>

  ${opts.bodyHtml}

  <div class="footer">
    Generated from Open Cave &mdash; opencave.ca
  </div>
</div>
</body>
</html>`
}


// ---------------------------------------------------------------------------
// FIPPA letter page (filings §1-2)
// ---------------------------------------------------------------------------

/**
 * How to drop the browser's own header and footer. Browsers print the page
 * title, address, date and page numbers in the margins, and CSS can't turn
 * that off, so the guidance page says how (A1, "no app page numbers").
 */
/** The same advice, one sentence, beside the Print button (screen only). */
const BROWSER_MARGIN_TIP_SHORT =
  'For a clean page, turn off "Headers and footers" in the print dialog.'

const BROWSER_MARGIN_TIP =
  'Your browser may print the page address, the date and page numbers in the margins. To leave them off, turn off "Headers and footers" in the print dialog (under "More settings" in Chrome and Edge, "Show details" in Safari).'

/**
 * The letter projection, then the guidance page after a page break.
 *
 * The letter is `<main>`'s first child, `.letter`, and holds nothing but the
 * letter's blocks, so its text is exactly the golden projection. Everything
 * that is not the letter (the Print button, the §2 notice, the empty-letter
 * note) sits outside it: the screen-only bar above, or the guidance page.
 */
function fippaPrintPage(title: string, content: string, letterFormat: unknown, status: unknown): string {
  const parsed = parseLetter(content, letterFormat)
  const clean = parsed.split === 'marker' && !parsed.fallback
  const letterEmpty = parsed.letter.length === 0

  const notes: string[] = []
  if (!clean) notes.push(uncleanSplitNotice(status))
  if (parsed.fallback) notes.push('Shown as plain text.')
  if (letterEmpty) notes.push('This letter part is empty.')
  const notesHtml = notes.map((n) => `<p class="note">${escapeHtml(n)}</p>`).join('\n')

  const guidanceHtml = parsed.guidance
    ? `<div class="guidance-text">\n${blocksToHtml(parsed.guidance)}\n</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Instrument+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page { margin: 1in; }

  html, body { background: #FFFFFF; }
  body {
    color: #1c1917;
    font-family: 'Source Serif 4', Georgia, serif;
    font-size: 12pt;
    line-height: 1.5;
    padding: 0 16px 3rem;
  }

  /* Screen-only bar: the Print button and the notices. It is its own row
     above the letter, never over it, at every width (RS-P2-5). */
  .screen-bar {
    max-width: 6.5in;
    margin: 0 auto;
    padding: 1.25rem 0 1.5rem;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 1.5rem;
    font-family: 'Instrument Sans', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: #44403c;
  }
  .screen-bar .notes { flex: 1 1 18rem; }
  .screen-bar .note + .note { margin-top: 0.25rem; }
  .print-action {
    flex: 0 1 15rem;
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.4rem;
    text-align: right;
  }
  .print-tip { font-size: 12px; line-height: 1.4; color: #57534e; }
  .print-btn {
    font: inherit;
    font-weight: 500;
    min-height: 44px;
    padding: 0 20px;
    background: #1c1917;
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .print-btn:focus-visible { outline: 2px solid #1c1917; outline-offset: 2px; }

  main { max-width: 6.5in; margin: 0 auto; }

  .lb { min-height: 1.5em; white-space: pre-wrap; overflow-wrap: anywhere; }
  .lb-h { font-size: inherit; font-weight: 600; }
  .lb-verbatim { font: inherit; }
  mark.ph {
    background: #FDF2D0; color: #6B3A06; padding: 0 0.1em; border-radius: 2px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* Hanging indent: wrapped lines of an item align after its prefix. */
  .lb-item { padding-left: 1.5em; text-indent: -1.5em; }
  /* A rule is a 1px hairline centred in its line; the element's text stays empty. */
  .lb-rule { position: relative; }
  .lb-rule::before {
    content: ''; position: absolute; left: 0; right: 0; top: 50%;
    border-top: 1px solid #A8A29E;
  }

  .guidance-page { break-before: page; page-break-before: always; }
  .guidance-page h1 {
    font-size: 15pt;
    font-weight: 600;
    margin-bottom: 1rem;
  }
  .guidance-page .note,
  .guidance-page .tip,
  .guidance-page .attribution { margin-top: 1rem; font-size: 10.5pt; color: #44403c; }
  .guidance-text { margin-bottom: 0.5rem; }

  @media screen {
    .guidance-page { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e7e5e4; }
    /* On screen the notices are in the bar above the letter; this copy is for paper. */
    .guidance-page .note { display: none; }
  }

  @media print {
    .screen-bar { display: none; }
    body { padding: 0; }
    main { max-width: none; }
  }
</style>
</head>
<body>
<div class="screen-bar">
<div class="notes">
${notesHtml}
</div>
<div class="print-action">
<button type="button" class="print-btn" onclick="window.print()">Print</button>
<p class="print-tip">${escapeHtml(BROWSER_MARGIN_TIP_SHORT)}</p>
</div>
</div>
<main>
<div class="letter">
${blocksToHtml(parsed.letter)}
</div>
<section class="guidance-page" aria-labelledby="guidance-title">
<h1 id="guidance-title">Not part of your request</h1>
${guidanceHtml}
${notes.length ? notesHtml : ''}
<p class="tip">${escapeHtml(BROWSER_MARGIN_TIP)}</p>
<p class="attribution">Prepared with Open Cave, opencave.ca</p>
</section>
</main>
</body>
</html>`
}
