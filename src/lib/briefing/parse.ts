/**
 * Briefing parser: the pure text-to-structure helpers behind the briefing view
 * (src/components/briefing/briefing-view.tsx). No React here; renderInline stays
 * in the view because it returns React nodes.
 */

export type RoleKey = 'regulator' | 'proponent' | 'affected' | 'indigenous' | 'other'

export interface ParsedSection {
  heading: string
  content: string
}

// ---- Section parser (also strips # Title lines before section parsing). D2 owns the parser now; the goldens in tests/unit/briefing-parse.test.ts are the contract. ----

export function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const lines = text.split('\n')
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    // Skip the # Title line — it is extracted separately by extractTitle()
    if (line.match(/^#\s+[^#]/)) continue

    const match = line.match(/^##\s+(.+)$/)
    if (match) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
      }
      currentHeading = match[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentLines.join('\n').trim() })
  }

  return sections
}

// ---- Title extractor (new prompt emits `# Title`; old prompts used ## Your Concern) ----

export function extractTitle(text: string): string | null {
  // New format: `# Title text`
  const h1Match = text.match(/^#\s+([^#\n].+)$/m)
  if (h1Match) return h1Match[1].trim()

  // Old prompts (## Context / ## Your Concern) do not emit a # Title line.
  // Let ExecutiveCard handle the concern display — no title to extract.
  return null
}

// ---- Gap/insight paragraph detection (for Gadfly-gold callout in Public Record Shows) ----

export function isInsightParagraph(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('the gap') ||
    lower.includes('what is absent') ||
    lower.includes('not publicly') ||
    lower.includes('absent from') ||
    lower.includes('should be there') ||
    lower.includes('remain unanswerable') ||
    lower.includes('remains unanswerable') ||
    lower.includes('the absence') ||
    lower.includes('is absent')
  )
}

// ---- Pull quote detection ----

export function isPullQuote(text: string): boolean {
  const trimmed = text.trim()
  // Starts and ends with quotation marks (straight or curly)
  if (/^["""]/.test(trimmed) && /["""][\.\,\;]?$/.test(trimmed)) return true
  // Contains a full sentence in quotes (at least 30 chars inside quotes)
  if (/["""][^"""]{30,}["""]/.test(trimmed)) return true
  return false
}

// ---- Block preprocessor result ----

export type BlockElement =
  | { type: 'paragraph'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'hr' }
  | { type: 'list'; items: string[] }

// ---- Block preprocessor — handles ###, ---, bold-only lines (no colon) ----
// Called by ProseSection before paragraph-level rendering.

/** A bulleted (`- `, `* `) or numbered (`1. `, `1) `) list line. */
const LIST_LINE = /^(?:[-*]|\d+[.)])\s+/

/** One blank-line-separated paragraph that holds no list line. */
function classifyBlock(para: string): BlockElement {
  // --- separator → hr (only when it's JUST "---" on its own, not inside other text)
  if (/^---\s*$/.test(para)) return { type: 'hr' }

  // ### Sub-heading
  if (para.match(/^###\s+/)) {
    return { type: 'subheading', text: para.replace(/^###\s+/, '').replace(/\*\*/g, '').trim() }
  }

  // Bold-only line (no colon) → treat as sub-heading
  // Must be a single line, wrapped entirely in **, no colon inside
  const boldOnlyMatch = para.match(/^\*\*([^*:]+)\*\*\s*$/)
  if (boldOnlyMatch && !para.includes('\n')) return { type: 'subheading', text: boldOnlyMatch[1].trim() }

  return { type: 'paragraph', text: para }
}

export function preprocessBlocks(content: string): BlockElement[] {
  const result: BlockElement[] = []

  // Split into raw paragraphs first (blank-line separated)
  const rawParagraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  for (const para of rawParagraphs) {
    const lines = para.split('\n')
    const firstListLine = lines.findIndex((l) => LIST_LINE.test(l))

    if (firstListLine === -1 || para.match(/^###\s+/)) {
      result.push(classifyBlock(para))
      continue
    }

    // A lead-in written in the same block as its list ("Two things you can do
    // this week:") is peeled off as its own block, before the list, instead of
    // becoming the list's first bullet.
    const leadIn = lines.slice(0, firstListLine).join('\n').trim()
    if (leadIn) result.push(classifyBlock(leadIn))

    // Bulleted and numbered items stay items, in order.
    const items = lines
      .slice(firstListLine)
      .filter((l) => l.trim())
      .map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
    result.push({ type: 'list', items })
  }

  // A rule at a section's edge separates nothing: drop it (the stray trailing
  // `---` a briefing often ends on). Rules between blocks stay.
  while (result.length > 0 && result[0].type === 'hr') result.shift()
  while (result.length > 0 && result[result.length - 1].type === 'hr') result.pop()

  return result
}

export interface PlayerData {
  name: string
  role: string
  whyTheyMatter: string
  trackRecord: string
}

/**
 * A role's island token stem (`--island-role-*` in globals.css). Rights holders
 * and Indigenous nations are tested before "community" and "local", so a Nation
 * described as a rights holder or a local First Nation wears the rights-holder
 * amber here, as it does in the Lens (Jen D1 C4).
 */
export function getRoleKey(role: string): RoleKey {
  const r = role.toLowerCase().replace(/_/g, ' ')
  if (r.includes('regulator') || r.includes('decision maker')) return 'regulator'
  if (r.includes('proponent') || r.includes('applicant') || r.includes('certificate holder')) return 'proponent'
  if (r.includes('beneficiary') || r.includes('affected')) return 'affected'
  if (r.includes('rights holder') || r.includes('indigenous') || r.includes('first nation')) return 'indigenous'
  if (r.includes('community') || r.includes('local')) return 'affected'
  // Whole word: "international" and "self-determination" are not nations (Razor D1 DN1).
  if (/\bnations?\b/.test(r)) return 'indigenous'
  return 'other'
}

/**
 * The words a role badge shows. The briefing prompt's enum values become plain
 * words; any other value has its underscores turned to spaces and is otherwise
 * shown as written (never a word the briefing did not use).
 */
export function roleLabel(role: string): string {
  const r = role.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (r === 'decision maker') return 'Decision-maker'
  if (r === 'rights holder') return 'Rights holder'
  if (r === 'proponent') return 'Proponent'
  return role.replace(/_/g, ' ')
}

/**
 * The value after a player field label (`**Role:** x`, `**Role**: x`,
 * `Role: x`), with the value's own markup kept for renderInline.
 */
function playerFieldValue(line: string, label: string): string {
  const m = line.match(new RegExp(`^(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:?\\s*(?:\\*\\*)?[:\\s]*([\\s\\S]*)$`, 'i'))
  return (m ? m[1] : '').replace(/^[-\s]+|[-\s]+$/g, '')
}

export function parsePlayers(content: string): PlayerData[] {
  const players: PlayerData[] = []

  const lines = content.split('\n').map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).filter((l) => l && !/^-{2,}$/.test(l))

  const fieldLabels = /^(?:\*\*)?(?:role|why they matter|track record|what they do|how they relate)(?:\*\*)?[:\s]/i

  let current: { name: string; role: string; whyTheyMatter: string; trackRecord: string } | null = null

  for (const line of lines) {
    // Labels are recognised on the line without bold markers; values are taken
    // from the line as written, so renderInline renders their markup.
    const cleanLine = line.replace(/\*\*/g, '')

    // A **Name:** field starts a player, and so does any line that is not a
    // field label (the bare-name form: `**City Planning**` then `Role: …`).
    const isName = /^name\s*:/i.test(cleanLine)
    if (isName || (!fieldLabels.test(cleanLine) && !cleanLine.startsWith('Role:'))) {
      if (current && current.name) players.push({ ...current })
      // A bare name wholly in bold is a heading; its ** are the heading's, not the name's.
      const bareName = line.match(/^\*\*([^*]+)\*\*$/)?.[1].trim() ?? line
      current = { name: isName ? playerFieldValue(line, 'name') : bareName, role: '', whyTheyMatter: '', trackRecord: '' }
      continue
    }

    if (!current) continue

    if (/^role[:\s]+\S/i.test(cleanLine)) { current.role = playerFieldValue(line, 'role'); continue }
    if (/^why they matter[:\s]+\S/i.test(cleanLine)) { current.whyTheyMatter = playerFieldValue(line, 'why they matter'); continue }
    if (/^track record[:\s]+\S/i.test(cleanLine)) { current.trackRecord = playerFieldValue(line, 'track record'); continue }
  }

  if (current && current.name) players.push({ ...current })

  return players
}

export interface JurisdictionData {
  name: string
  /** Prose under the name that is not a field line, one entry per paragraph. */
  body: string[]
  whatTheyDid: string
  whyItMatters: string
  outcome: string
}

type JurisdictionField = 'whatTheyDid' | 'whyItMatters' | 'outcome'

// A Mirror field comes only from a line that opens with its label and a colon
// (`**Outcome:** x`, `**Outcome**: x`, `Outcome: x`), after optional
// indentation or a bullet. Never from the word inside prose, and never by
// position: "The outcome is not documented" is prose (D2).
const WHAT_THEY_DID_LINE = /^\s*(?:[-*]\s+)?(?:\*\*what they did(?:\s+[\w']+){0,3}:\*\*|\*\*what they did(?:\s+[\w']+){0,3}\*\*:|what they did(?:\s+[\w']+){0,3}:)\s*(.*)$/i
const WHY_IT_MATTERS_LINE = /^\s*(?:[-*]\s+)?(?:\*\*why it matters(?:\s+[\w']+){0,3}:\*\*|\*\*why it matters(?:\s+[\w']+){0,3}\*\*:|why it matters(?:\s+[\w']+){0,3}:)\s*(.*)$/i
const OUTCOME_LINE = /^\s*(?:[-*]\s+)?(?:\*\*outcome:\*\*|\*\*outcome\*\*:|outcome:)\s*(.*)$/i

function matchJurisdictionField(line: string): { key: JurisdictionField; value: string } | null {
  const what = line.match(WHAT_THEY_DID_LINE)
  if (what) return { key: 'whatTheyDid', value: what[1].trim() }
  const why = line.match(WHY_IT_MATTERS_LINE)
  if (why) return { key: 'whyItMatters', value: why[1].trim() }
  const outcome = line.match(OUTCOME_LINE)
  if (outcome) return { key: 'outcome', value: outcome[1].trim() }
  return null
}

/**
 * A line that opens a jurisdiction, with its name and any prose after the name
 * on the same line: `### Name`, a line wholly in bold, or a bullet led by a
 * bold name (`- **Town A** publishes …`). A bold span ending in a colon is a
 * field label, not a name.
 */
function matchJurisdictionStart(line: string): { name: string; rest: string } | null {
  const h3 = line.match(/^###\s+(.+)$/)
  if (h3) return { name: h3[1].trim(), rest: '' }
  const bold = line.match(/^\*\*([^*]+)\*\*\s*$/)
  if (bold && !bold[1].trim().endsWith(':')) return { name: bold[1].trim(), rest: '' }
  const led = line.match(/^[-*]\s+\*\*([^*]+)\*\*(.*)$/)
  if (led && !led[1].trim().endsWith(':') && !led[2].trim().startsWith(':')) return { name: led[1].trim(), rest: led[2].trim() }
  return null
}

export function parseJurisdictions(content: string): JurisdictionData[] {
  const jurisdictions: JurisdictionData[] = []
  let current: JurisdictionData | null = null
  // The field a following non-blank line continues, until a blank line.
  let openField: JurisdictionField | null = null
  // The body paragraph a following non-blank line continues, until a blank line.
  let openParagraph = false

  for (const raw of content.split('\n')) {
    const line = raw.trim()

    if (!line || /^-{3,}$/.test(line)) {
      openField = null
      openParagraph = false
      continue
    }

    const start = matchJurisdictionStart(line)
    if (start) {
      if (current) jurisdictions.push(current)
      current = { name: start.name, body: [], whatTheyDid: '', whyItMatters: '', outcome: '' }
      openField = null
      openParagraph = false
      if (start.rest) {
        current.body.push(start.rest)
        openParagraph = true
      }
      continue
    }

    // Text before the first jurisdiction has no card to go on (as before D2).
    if (!current) continue

    const field = matchJurisdictionField(line)
    if (field) {
      current[field.key] = field.value
      openField = field.key
      openParagraph = false
      continue
    }

    // A bullet under a jurisdiction is a body paragraph of its own, without its marker.
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      openField = null
      current.body.push(bullet[1].trim())
      openParagraph = true
    } else if (openField) {
      current[openField] = `${current[openField]} ${line}`.trim()
    } else if (openParagraph) {
      current.body[current.body.length - 1] += ` ${line}`
    } else {
      current.body.push(line)
      openParagraph = true
    }
  }

  if (current) jurisdictions.push(current)

  return jurisdictions
}

// ---- Document field parser. D2 owns the parser now; the goldens in tests/unit/briefing-parse.test.ts are the contract. ----

export interface DocumentField {
  label: string
  value: string
}

export function parseDocumentFields(block: string): DocumentField[] {
  const lines = block.split('\n')
  const fields: DocumentField[] = []
  let current: DocumentField | null = null

  for (const line of lines) {
    const match = line.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/)
    if (match) {
      if (current) fields.push(current)
      current = { label: match[1].trim(), value: match[2].trim() }
    } else if (current && line.trim()) {
      current.value += ' ' + line.trim()
    }
  }
  if (current) fields.push(current)
  return fields
}

export type AccessLevel = 'public' | 'fippa' | 'council'

export function detectAccess(text: string): AccessLevel | null {
  const lower = text.toLowerCase()
  if (lower.includes('fippa required') || lower.includes('fippa request')) return 'fippa'
  if (lower.includes('council record')) return 'council'
  if (lower.includes('public')) return 'public'
  return null
}

// ---- Block splitter. D2 owns the parser now; the goldens in tests/unit/briefing-parse.test.ts are the contract. ----

export function splitDocumentBlocks(content: string): string[] {
  const blocks: string[] = []
  const lines = content.split('\n')
  let currentBlock: string[] = []

  for (const line of lines) {
    const isBlockStart =
      line.match(/^###\s+/) ||
      (line.match(/^\*\*.+\*\*$/) && !line.match(/^[-*]\s+\*\*/)) ||
      line.match(/^[-*]\s+\*\*Document name:\*\*/i)

    if (isBlockStart && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n').trim())
      currentBlock = [line]
    } else {
      currentBlock.push(line)
    }
  }

  if (currentBlock.length > 0 && currentBlock.join('').trim()) {
    blocks.push(currentBlock.join('\n').trim())
  }

  return blocks.length > 0 ? blocks : [content]
}

// ---- FIPPA letter extractor. D2 owns the parser now; the goldens in tests/unit/briefing-parse.test.ts are the contract. ----
// The \n---\n...\n---\n fence is load-bearing for What You Can Do: preprocessBlocks'
// leading/trailing rule drop never sees it, because this runs on the raw section first.

export function extractFippaLetter(content: string): { before: string; letter: string; after: string } | null {
  const hrPattern = /\n---\n([\s\S]+?)\n---\n/
  const match = content.match(hrPattern)
  if (!match) return null

  const idx = content.indexOf(match[0])
  return {
    before: content.slice(0, idx).trim(),
    letter: match[1].trim(),
    after: content.slice(idx + match[0].length).trim(),
  }
}
