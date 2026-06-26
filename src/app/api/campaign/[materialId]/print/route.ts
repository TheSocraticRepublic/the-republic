import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { campaignMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  campaignMaterialSchema,
  MATERIAL_TYPE_LABELS,
} from '@/lib/campaign/schemas'
import type { CampaignMaterial } from '@/lib/campaign/schemas'
import { esc, safeHref, errorPage, PRINT_CSP } from '@/lib/campaign/print-utils'
import { checkRateLimit } from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ materialId: string }>
}

/**
 * GET /api/campaign/[materialId]/print
 * Returns a print-ready HTML page for a campaign material.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
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

  const { success } = await checkRateLimit(`campaign-print:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { materialId } = await params
  const db = getDb()

  const [material] = await db
    .select()
    .from(campaignMaterials)
    .where(and(eq(campaignMaterials.id, materialId), eq(campaignMaterials.userId, userId)))
    .limit(1)

  if (!material) {
    return new Response(errorPage('Material not found'), {
      status: 404,
      headers: printHeaders,
    })
  }

  let parsed: CampaignMaterial
  try {
    const raw = JSON.parse(material.content)
    parsed = campaignMaterialSchema.parse(raw)
  } catch {
    return new Response(errorPage('Could not parse material content'), {
      status: 422,
      headers: printHeaders,
    })
  }

  const label = MATERIAL_TYPE_LABELS[parsed.materialType] ?? parsed.materialType
  const bodyHtml = renderMaterialBody(parsed)
  const sourcesHtml = renderSources(parsed)
  const date = new Date(material.createdAt).toISOString().slice(0, 10)

  const html = printPage({
    title: parsed.title,
    label,
    date,
    bodyHtml,
    sourcesHtml,
  })

  return new Response(html, {
    status: 200,
    headers: printHeaders,
  })
}

// ---------------------------------------------------------------------------
// Material type renderers
// ---------------------------------------------------------------------------

function renderMaterialBody(spec: CampaignMaterial): string {
  switch (spec.materialType) {
    case 'infographic':
      return renderInfographic(spec)
    case 'fact_sheet':
      return renderFactSheet(spec)
    case 'social_post':
      return renderSocialPost(spec)
    case 'talking_points':
      return renderTalkingPoints(spec)
    case 'timeline':
      return renderTimeline(spec)
    case 'comparison':
      return renderComparison(spec)
    default:
      return `<pre>${esc(JSON.stringify(spec, null, 2))}</pre>`
  }
}

function renderInfographic(spec: CampaignMaterial & { materialType: 'infographic' }): string {
  const lines: string[] = []

  lines.push('<section class="section">')
  lines.push('<h2 class="section-label">Key Data Points</h2>')
  spec.dataPoints.forEach((dp, i) => {
    const emphClass = dp.emphasis ? ' emphasis' : ''
    lines.push(`<div class="data-row${emphClass}">`)
    lines.push(`  <span class="data-index">${i + 1}</span>`)
    lines.push(`  <span class="data-label">${esc(dp.label)}</span>`)
    lines.push(`  <span class="data-value">${esc(String(dp.value))}</span>`)
    lines.push('</div>')
  })
  lines.push('</section>')

  if (spec.comparison) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Before / After</h2>')
    lines.push('<div class="comparison-grid">')
    lines.push(`<div class="comparison-cell"><span class="cell-label">Before</span>${esc(spec.comparison.before)}</div>`)
    lines.push(`<div class="comparison-cell accent"><span class="cell-label">After</span>${esc(spec.comparison.after)}</div>`)
    lines.push('</div>')
    lines.push('</section>')
  }

  if (spec.timeline && spec.timeline.length > 0) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Timeline</h2>')
    spec.timeline.forEach((t) => {
      lines.push(`<div class="timeline-item"><strong>${esc(t.date)}</strong> &mdash; ${esc(t.event)}</div>`)
    })
    lines.push('</section>')
  }

  lines.push('<section class="section cta">')
  lines.push(`<h2 class="section-label">Call to Action</h2>`)
  lines.push(`<p>${esc(spec.callToAction)}</p>`)
  lines.push('</section>')

  return lines.join('\n')
}

function renderFactSheet(spec: CampaignMaterial & { materialType: 'fact_sheet' }): string {
  const lines: string[] = []

  lines.push(`<p class="headline">${esc(spec.headline)}</p>`)

  lines.push('<section class="section">')
  lines.push('<h2 class="section-label">Key Findings</h2>')
  spec.keyFindings.forEach((kf, i) => {
    lines.push('<div class="finding">')
    lines.push(`  <span class="finding-number">${i + 1}</span>`)
    lines.push(`  <div>`)
    lines.push(`    <p class="finding-text">${esc(kf.finding)}</p>`)
    lines.push(`    <p class="finding-evidence">${esc(kf.evidence)}</p>`)
    lines.push(`    <p class="finding-source">Source: ${esc(kf.source)}</p>`)
    lines.push(`  </div>`)
    lines.push('</div>')
  })
  lines.push('</section>')

  if (spec.playerProfiles.length > 0) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Key Players</h2>')
    spec.playerProfiles.forEach((p) => {
      lines.push('<div class="player">')
      lines.push(`  <p class="player-name">${esc(p.name)}</p>`)
      lines.push(`  <p class="player-role">${esc(p.role)}</p>`)
      lines.push(`  <p class="player-record">${esc(p.trackRecord)}</p>`)
      lines.push('</div>')
    })
    lines.push('</section>')
  }

  if (spec.actionItems.length > 0) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Action Items</h2>')
    lines.push('<ul class="checklist">')
    spec.actionItems.forEach((item) => {
      lines.push(`  <li>${esc(item)}</li>`)
    })
    lines.push('</ul>')
    lines.push('</section>')
  }

  return lines.join('\n')
}

function renderSocialPost(spec: CampaignMaterial & { materialType: 'social_post' }): string {
  const lines: string[] = []

  spec.variations.forEach((v, i) => {
    lines.push(`<section class="section social-variation">`)
    lines.push(`<h2 class="section-label">Variation ${i + 1}: ${esc(v.tone)}</h2>`)
    lines.push(`<p class="social-text">${esc(v.text)}</p>`)
    if (v.hashtags.length > 0) {
      lines.push(`<p class="social-hashtags">${v.hashtags.map((h) => '#' + esc(h)).join(' ')}</p>`)
    }
    lines.push(`<p class="social-meta">${v.characterCount} characters &middot; Source: ${esc(v.source)}</p>`)
    lines.push('</section>')
  })

  return lines.join('\n')
}

function renderTalkingPoints(spec: CampaignMaterial & { materialType: 'talking_points' }): string {
  const lines: string[] = []

  lines.push(`<p class="context-line">${esc(spec.context)}</p>`)

  spec.points.forEach((p, i) => {
    lines.push('<section class="section talking-point">')
    lines.push(`<h2 class="section-label">Point ${i + 1}</h2>`)
    lines.push(`<p class="tp-claim"><strong>${esc(p.claim)}</strong></p>`)
    lines.push(`<div class="tp-field"><span class="tp-label">Evidence</span><p>${esc(p.evidence)}</p></div>`)
    lines.push(`<div class="tp-field"><span class="tp-label">Anticipated Pushback</span><p>${esc(p.anticipatedPushback)}</p></div>`)
    lines.push(`<div class="tp-field"><span class="tp-label">Response</span><p>${esc(p.response)}</p></div>`)
    lines.push(`<p class="tp-source">Source: ${esc(p.source)}</p>`)
    lines.push('</section>')
  })

  return lines.join('\n')
}

function renderTimeline(spec: CampaignMaterial & { materialType: 'timeline' }): string {
  const lines: string[] = []

  const sortedEvents = [...spec.events].sort((a, b) => {
    const aTime = new Date(a.date).getTime()
    const bTime = new Date(b.date).getTime()
    if (isNaN(aTime) && isNaN(bTime)) return 0
    if (isNaN(aTime)) return 1
    if (isNaN(bTime)) return -1
    return aTime - bTime
  })

  if (sortedEvents.length > 0) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Events</h2>')
    sortedEvents.forEach((e) => {
      const actor = e.actor ? ` <span class="actor">(${esc(e.actor)})</span>` : ''
      lines.push('<div class="timeline-event">')
      lines.push(`  <span class="timeline-date">${esc(e.date)}</span>`)
      lines.push(`  <div>`)
      lines.push(`    <p class="timeline-text">${esc(e.event)}${actor}</p>`)
      if (e.significance) {
        lines.push(`    <p class="timeline-sig">${esc(e.significance)}</p>`)
      }
      lines.push(`  </div>`)
      lines.push('</div>')
    })
    lines.push('</section>')
  }

  if (spec.deadlines.length > 0) {
    lines.push('<section class="section">')
    lines.push('<h2 class="section-label">Deadlines</h2>')
    spec.deadlines.forEach((d) => {
      const critClass = d.critical ? ' critical' : ''
      lines.push(`<div class="deadline${critClass}">`)
      lines.push(`  <span class="timeline-date">${esc(d.date)}</span>`)
      lines.push(`  <span>${esc(d.action)}${d.critical ? ' <strong>[CRITICAL]</strong>' : ''}</span>`)
      lines.push('</div>')
    })
    lines.push('</section>')
  }

  return lines.join('\n')
}

function renderComparison(spec: CampaignMaterial & { materialType: 'comparison' }): string {
  const lines: string[] = []

  lines.push('<section class="section">')
  lines.push('<h2 class="section-label">Subject</h2>')
  lines.push('<div class="subject-card">')
  lines.push(`  <p class="subject-jurisdiction">${esc(spec.subject.jurisdiction)}</p>`)
  lines.push(`  <p>${esc(spec.subject.policy)}</p>`)
  if (spec.subject.outcome) {
    lines.push(`  <p class="subject-outcome">${esc(spec.subject.outcome)}</p>`)
  }
  lines.push('</div>')
  lines.push('</section>')

  lines.push('<section class="section">')
  lines.push('<h2 class="section-label">Alternatives</h2>')
  spec.alternatives.forEach((alt) => {
    lines.push('<div class="alt-card">')
    lines.push(`  <p class="alt-jurisdiction">${esc(alt.jurisdiction)}</p>`)
    lines.push(`  <p class="alt-policy">${esc(alt.policy)}</p>`)
    lines.push(`  <p class="alt-outcome">${esc(alt.outcome)}</p>`)
    lines.push(`  <p class="alt-source">Source: ${esc(alt.source)}</p>`)
    lines.push('</div>')
  })
  lines.push('</section>')

  lines.push('<section class="section">')
  lines.push('<h2 class="section-label">The Argument from Existence</h2>')
  lines.push(`<p class="argument-text">${esc(spec.argumentFromExistence)}</p>`)
  lines.push('</section>')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Sources + HTML shell
// ---------------------------------------------------------------------------

function renderSources(spec: CampaignMaterial): string {
  if (!spec.sources || spec.sources.length === 0) return ''
  const lines: string[] = []
  lines.push('<section class="section sources">')
  lines.push('<h2 class="section-label">Sources</h2>')
  lines.push('<ol>')
  spec.sources.forEach((s) => {
    if (s.url) {
      lines.push(`<li><a href="${safeHref(s.url)}">${esc(s.text)}</a></li>`)
    } else {
      lines.push(`<li>${esc(s.text)}</li>`)
    }
  })
  lines.push('</ol>')
  lines.push('</section>')
  return lines.join('\n')
}

function printPage(opts: {
  title: string
  label: string
  date: string
  bodyHtml: string
  sourcesHtml: string
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
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 700;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C85B5B;
    margin-bottom: 1rem;
  }
  .doc-label {
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #C85B5B;
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

  /* Sections */
  .section { margin-bottom: 2rem; }
  .section-label {
    font-family: 'Instrument Sans', sans-serif;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #C85B5B;
    margin-bottom: 0.75rem;
  }

  /* Data rows (infographic) */
  .data-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #e7e5e4;
  }
  .data-row.emphasis { background: rgba(200, 91, 91, 0.04); padding: 0.5rem 0.75rem; border-radius: 6px; border-bottom: none; }
  .data-index { font-size: 11px; color: #C85B5B; font-weight: 500; flex-shrink: 0; width: 1.5rem; }
  .data-label { flex: 1; }
  .data-value { font-weight: 500; flex-shrink: 0; }
  .data-row.emphasis .data-value { color: #C85B5B; }

  /* Comparison grid */
  .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .comparison-cell { padding: 1rem; background: #f5f4f3; border-radius: 8px; border: 1px solid #e7e5e4; }
  .comparison-cell.accent { border-color: rgba(200, 91, 91, 0.3); background: rgba(200, 91, 91, 0.04); }
  .cell-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #78716c; margin-bottom: 0.25rem; }

  /* Headline (fact sheet) */
  .headline { font-family: 'Instrument Sans', sans-serif; font-weight: 600; font-size: 16px; margin-bottom: 1.5rem; color: #1c1917; }

  /* Findings */
  .finding { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
  .finding-number { font-size: 12px; color: #C85B5B; font-weight: 500; flex-shrink: 0; padding-top: 2px; }
  .finding-text { font-weight: 500; margin-bottom: 0.25rem; }
  .finding-evidence { font-size: 13px; color: #44403c; }
  .finding-source { font-size: 11px; color: #78716c; margin-top: 0.25rem; }

  /* Players */
  .player { margin-bottom: 1rem; padding: 0.75rem; background: #f5f4f3; border-radius: 6px; }
  .player-name { font-weight: 500; }
  .player-role { font-size: 12px; color: #78716c; }
  .player-record { font-size: 13px; color: #44403c; margin-top: 0.25rem; }

  /* Checklist */
  .checklist { list-style: none; padding: 0; }
  .checklist li { padding: 0.35rem 0; padding-left: 1.5rem; position: relative; }
  .checklist li::before { content: '\\25A1'; position: absolute; left: 0; color: #C85B5B; }

  /* Social posts */
  .social-variation { padding: 1rem; background: #f5f4f3; border-radius: 8px; border: 1px solid #e7e5e4; }
  .social-text { margin: 0.5rem 0; line-height: 1.6; }
  .social-hashtags { font-size: 12px; color: #78716c; }
  .social-meta { font-size: 11px; color: #a8a29e; margin-top: 0.5rem; }

  /* Talking points */
  .context-line { font-style: italic; color: #44403c; margin-bottom: 1.5rem; padding-left: 1rem; border-left: 3px solid #C85B5B; }
  .talking-point { page-break-inside: avoid; }
  .tp-claim { margin-bottom: 0.5rem; }
  .tp-field { margin-bottom: 0.5rem; }
  .tp-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #78716c; margin-bottom: 0.15rem; }
  .tp-source { font-size: 11px; color: #a8a29e; }

  /* Timeline */
  .timeline-event, .deadline { display: flex; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid #e7e5e4; }
  .timeline-date { font-weight: 500; font-size: 12px; color: #78716c; flex-shrink: 0; min-width: 90px; }
  .timeline-text { font-weight: 400; }
  .timeline-sig { font-size: 12px; color: #78716c; }
  .actor { color: #78716c; }
  .deadline.critical { background: rgba(200, 91, 91, 0.04); padding: 0.5rem 0.75rem; border-radius: 6px; border-bottom: none; }

  /* Comparison */
  .subject-card { padding: 1rem; background: rgba(200, 91, 91, 0.04); border: 1px solid rgba(200, 91, 91, 0.15); border-radius: 8px; margin-bottom: 1rem; }
  .subject-jurisdiction { font-weight: 600; color: #C85B5B; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; }
  .subject-outcome { font-size: 13px; color: #78716c; margin-top: 0.25rem; }
  .alt-card { padding: 1rem; background: #f5f4f3; border: 1px solid #e7e5e4; border-radius: 8px; margin-bottom: 0.75rem; }
  .alt-jurisdiction { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; margin-bottom: 0.25rem; }
  .alt-policy { margin-bottom: 0.25rem; }
  .alt-outcome { font-size: 13px; color: #44403c; }
  .alt-source { font-size: 11px; color: #a8a29e; margin-top: 0.25rem; }
  .argument-text { line-height: 1.7; color: #44403c; }

  /* CTA (infographic) */
  .cta p { font-weight: 500; color: #1c1917; }

  /* Sources */
  .sources ol { padding-left: 1.25rem; }
  .sources li { font-size: 12px; color: #44403c; margin-bottom: 0.25rem; }
  .sources a { color: #C85B5B; text-decoration: underline; }

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
    .section { page-break-inside: avoid; }
    .header { border-bottom-color: #C85B5B; }
    @page { margin: 1in; }
  }

  /* Timeline item (infographic) */
  .timeline-item { padding: 0.35rem 0; }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Print</button>
<div class="page">
  <div class="header">
    <p class="wordmark">OPEN CAVE</p>
    <p class="doc-label">${esc(opts.label)}</p>
    <h1 class="doc-title">${esc(opts.title)}</h1>
    <p class="doc-date">${esc(opts.date)}</p>
  </div>

  ${opts.bodyHtml}

  ${opts.sourcesHtml}

  <div class="footer">
    Generated from Open Cave &mdash; opencave.ca
  </div>
</div>
</body>
</html>`
}
