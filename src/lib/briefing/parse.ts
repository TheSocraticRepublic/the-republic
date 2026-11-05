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

// ---- Section router: which renderer a ## section gets. BriefingView switches on this. ----

export type SectionKind =
  | 'context'
  | 'governs'
  | 'players'
  | 'record'
  | 'actions'
  | 'comparison'
  | 'questions'
  | 'limitations'
  | 'other'

/** Heading tests in BriefingView's historical order: the first match wins. */
export function routeSection(heading: string): SectionKind {
  const h = heading.toLowerCase()
  if (h.includes('context') || h.includes('your concern')) return 'context'
  if (h.includes('what governs') || h.includes('governs this')) return 'governs'
  if (h.includes('key players')) return 'players'
  if (h.includes('public record') || h.includes('record shows')) return 'record'
  if (h.includes('what you can do') || h.includes('you can do')) return 'actions'
  if (h.includes('other places') || h.includes('how other')) return 'comparison'
  if (h.includes('questions worth') || h.includes('worth asking')) return 'questions'
  if (h.includes('cannot see') || h.includes('limitations')) return 'limitations'
  return 'other'
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

export type PlayerField = 'whyTheyMatter' | 'trackRecord' | 'whatTheyDo' | 'howTheyRelate'

/** A player's content after the name and role badge, in source order. */
export type PlayerPart = { type: 'field'; key: PlayerField; value: string } | { type: 'prose'; text: string }

export interface PlayerData {
  name: string
  role: string
  parts: PlayerPart[]
}

/** Key Players in source order: player cards and the section prose around them. Nothing is dropped. */
export type PlayersItem = { type: 'player'; player: PlayerData } | { type: 'prose'; text: string }

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
 * words; any other value has its underscores turned to spaces and its first
 * letter capitalised, and is otherwise shown as written (never a word the
 * briefing did not use). Badges are sentence case, not CSS uppercase.
 */
export function roleLabel(role: string): string {
  const r = role.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  if (r === 'decision maker') return 'Decision-maker'
  if (r === 'rights holder') return 'Rights holder'
  if (r === 'proponent') return 'Proponent'
  // Any other value: the briefing's own word, underscores as spaces, first letter capitalised.
  const words = role.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const PLAYER_LABELS: [key: 'name' | 'role' | PlayerField, label: string][] = [
  ['name', 'name'],
  ['role', 'role'],
  ['whyTheyMatter', 'why they matter'],
  ['trackRecord', 'track record'],
  ['whatTheyDo', 'what they do'],
  ['howTheyRelate', 'how they relate'],
]
const PLAYER_FIELD_LINES = PLAYER_LABELS.map(
  ([key, label]) => [key, new RegExp(String.raw`^(?:\*\*${label}:\*\*|\*\*${label}\*\*\s*:|${label}\s*:)\s*(.*)$`, 'i')] as const
)

/**
 * A player field line (`**Role:** x`, `**Role**: x`, `Role: x`; colon
 * required), with the value's own markup kept for renderInline.
 */
function matchPlayerField(text: string): { key: 'name' | 'role' | PlayerField; value: string } | null {
  for (const [key, re] of PLAYER_FIELD_LINES) {
    const m = text.match(re)
    if (m) return { key, value: m[1].replace(/^[-\s]+|[-\s]+$/g, '') }
  }
  return null
}

interface PlayerLine {
  bulleted: boolean
  indented: boolean
  text: string
}

/**
 * Key Players, in source order. A player starts at a `Name:` field, at a line
 * wholly in bold, or at a bare line followed by a field (`City Planning` then
 * `Role: …`). Text the parser does not recognise is never dropped (Razor C2):
 * before the first player it is section prose; inside a player it is a prose
 * part in position; after a player's last field, past a blank line, it closes
 * the card and is section prose after it. A wrapped field value (an
 * unbulleted line straight after a field) joins the open field instead of
 * starting a player.
 */
export function parsePlayers(content: string): PlayersItem[] {
  const raw = content.split('\n')
  const lines: PlayerLine[] = raw.map((l) => ({
    bulleted: /^\s*[-*]\s+/.test(l),
    indented: /^\s+\S/.test(l) && !/^\s*[-*]\s+/.test(l),
    text: l.replace(/^\s*[-*]\s+/, '').trim(),
  }))
  const isGap = (t: string) => !t || /^-{2,}$/.test(t)
  const nextIsField = (i: number): boolean => {
    for (let j = i + 1; j < lines.length; j++) {
      if (isGap(lines[j].text)) continue
      const f = matchPlayerField(lines[j].text)
      return f !== null && f.key !== 'name'
    }
    return false
  }

  type Part = PlayerPart & { line: number; afterBlank: boolean }
  const players: { data: Omit<PlayerData, 'parts'>; parts: Part[]; start: number }[] = []
  let open: Part | null = null
  let openBulleted = false
  let blank = false

  const startPlayer = (name: string, i: number) => {
    players.push({ data: { name, role: '' }, parts: [], start: i })
    open = null
    blank = false
  }

  lines.forEach((line, i) => {
    const { text } = line
    if (isGap(text)) {
      open = null
      blank = true
      return
    }
    const current = players[players.length - 1]
    const field = matchPlayerField(text)
    const boldName = text.match(/^\*\*([^*]+)\*\*$/)?.[1].trim()

    if (field?.key === 'name') return startPlayer(field.value, i)
    if (field) {
      if (!current) return
      if (field.key === 'role') {
        // A second Role line joins the first, in order; it never replaces it.
        current.data.role = [current.data.role, field.value].filter(Boolean).join(' / ')
        open = null
      } else {
        open = { type: 'field', key: field.key, value: field.value, line: i, afterBlank: blank }
        openBulleted = line.bulleted
        current.parts.push(open)
      }
      blank = false
      return
    }
    // A name wholly in bold is a heading; its ** are the heading's, not the name's.
    if (boldName && !matchPlayerField(boldName.replace(/:?$/, ':'))) return startPlayer(boldName, i)
    const o = open as Part | null
    if (current && o && !blank && !line.bulleted && (openBulleted || line.indented || !nextIsField(i))) {
      if (o.type === 'field') o.value = `${o.value} ${text}`
      else o.text = `${o.text} ${text}`
      return
    }
    // The bare-name form, unless the line sits under a name that has no role or
    // field yet: there it is a note under that name.
    const underBareName = current && !current.data.role && !current.parts.some((p) => p.type === 'field')
    if (nextIsField(i) && !underBareName) return startPlayer(text, i)
    if (!current) return
    open = { type: 'prose', text, line: i, afterBlank: blank }
    openBulleted = line.bulleted
    current.parts.push(open)
    blank = false
  })

  if (players.length === 0) return []

  const items: PlayersItem[] = []
  const lead = proseFrom(raw.slice(0, players[0].start))
  if (lead) items.push({ type: 'prose', text: lead })

  players.forEach((p, k) => {
    const end = k + 1 < players.length ? players[k + 1].start : raw.length
    let lastField = -1
    p.parts.forEach((part, j) => {
      if (part.type === 'field') lastField = j
    })
    // After the last field, prose past a blank line is not this player's.
    const cut = p.parts.findIndex((part, j) => j > lastField && (lastField === -1 || part.afterBlank))
    const kept = cut === -1 ? p.parts : p.parts.slice(0, cut)
    const parts: PlayerPart[] = kept.map((part) =>
      part.type === 'field' ? { type: 'field', key: part.key, value: part.value } : { type: 'prose', text: part.text }
    )
    items.push({ type: 'player', player: { ...p.data, parts } })
    const after = cut === -1 ? null : proseFrom(raw.slice(p.parts[cut].line, end))
    if (after) items.push({ type: 'prose', text: after })
  })

  return items
}

export type JurisdictionField = 'whatTheyDid' | 'whyItMatters' | 'outcome'

/** A jurisdiction's content in source order: prose and fields interleave as written. */
export type JurisdictionPart =
  | { type: 'body'; text: string }
  | { type: 'field'; key: JurisdictionField; value: string }

export interface JurisdictionData {
  name: string
  parts: JurisdictionPart[]
}

/**
 * How Other Places Handle This, in source order: jurisdiction cards, and the
 * section prose around them (a lead-in before the first place, a closing
 * paragraph after the last). Nothing is dropped.
 */
export type ComparisonItem = { type: 'jurisdiction'; jurisdiction: JurisdictionData } | { type: 'prose'; text: string }

// A Mirror field comes only from a line that opens with its label and a colon
// (`**Outcome:** x`, `**Outcome**: x`, `Outcome: x`), after optional
// indentation or a bullet. Never from the word inside prose, and never by
// position: "The outcome is not documented" is prose (D2). The labels take
// the briefing prompt's own phrasings (briefing-system.ts: "What they did
// differently", "Why it matters for the citizen's situation", "What the
// outcome was"): What they did and Why it matters accept any trailing words
// up to the colon, within one clause.
const TRAILING = String.raw`(?:\s+[^:*.!?\n]{1,60}?)?`
const MIRROR_LABELS: Record<JurisdictionField, string> = {
  whatTheyDid: String.raw`what they did${TRAILING}`,
  whyItMatters: String.raw`why it matters${TRAILING}`,
  outcome: String.raw`(?:outcome|what the outcome was)`,
}
const mirrorLine = (label: string) =>
  new RegExp(String.raw`^\s*(?:[-*]\s+)?(?:\*\*${label}:\*\*|\*\*${label}\*\*\s*:|${label}:)\s*(.*)$`, 'i')
const WHAT_THEY_DID_LINE = mirrorLine(MIRROR_LABELS.whatTheyDid)
const WHY_IT_MATTERS_LINE = mirrorLine(MIRROR_LABELS.whyItMatters)
const OUTCOME_LINE = mirrorLine(MIRROR_LABELS.outcome)

/** Bold text that is a Mirror field label, with or without a colon or trailing words. */
const MIRROR_LABEL_TEXT = /^(?:what they did|why it matters|outcome|what the outcome was)\b/i

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
 * A line that opens a jurisdiction: a `### Name` heading, or, only in a section
 * with no `###` headings at all, a line wholly in bold whose text is not a
 * Mirror field label. A bold-led bullet never opens one (Razor C1: it invented
 * places from "- **Policy 4.2** requires ..." and colon-less labels).
 */
function matchJurisdictionStart(line: string, sectionHasHeadings: boolean): { name: string } | null {
  const h3 = line.match(/^###\s+(.+)$/)
  if (h3) return { name: h3[1].trim() }
  if (sectionHasHeadings) return null
  const bold = line.match(/^\*\*([^*]+)\*\*\s*$/)
  if (bold && !MIRROR_LABEL_TEXT.test(bold[1].trim()) && !bold[1].trim().endsWith(':')) return { name: bold[1].trim() }
  return null
}

/** Section prose from source lines, or null when they hold only blank lines and rules. */
function proseFrom(lines: string[]): string | null {
  if (lines.every((l) => !l.trim() || /^-{3,}\s*$/.test(l.trim()))) return null
  return lines.join('\n').trim()
}

/**
 * One jurisdiction's lines (after its name). Fields and prose become parts in
 * source order. A field value continues on following plain lines until a blank
 * line. Prose after the last field, past a blank line, is not the place's: it
 * closes the card and is returned as trailing section prose (the prompt's
 * closing "Argument from Existence" paragraph lands below the cards).
 */
function parseJurisdictionLines(name: string, lines: string[]): { jurisdiction: JurisdictionData; trailing: string[] } {
  const parts: (JurisdictionPart & { line: number; afterBlank: boolean })[] = []
  let open: number | null = null
  let blank = false

  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) {
      open = null
      blank = true
      return
    }
    const field = matchJurisdictionField(line)
    if (field) {
      parts.push({ type: 'field', key: field.key, value: field.value, line: i, afterBlank: blank })
      open = parts.length - 1
      blank = false
      return
    }
    // A bullet is a body paragraph of its own, without its marker.
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      parts.push({ type: 'body', text: bullet[1].trim(), line: i, afterBlank: blank })
      open = parts.length - 1
      blank = false
      return
    }
    if (open !== null) {
      const part = parts[open]
      if (part.type === 'field') part.value = `${part.value} ${line}`.trim()
      else part.text = `${part.text} ${line}`
      return
    }
    parts.push({ type: 'body', text: line, line: i, afterBlank: blank })
    open = parts.length - 1
    blank = false
  })

  let lastField = -1
  parts.forEach((p, k) => {
    if (p.type === 'field') lastField = k
  })
  const cut = lastField === -1 ? -1 : parts.findIndex((p, k) => k > lastField && p.afterBlank)
  const kept = cut === -1 ? parts : parts.slice(0, cut)
  const trailing = cut === -1 ? [] : lines.slice(parts[cut].line)

  return {
    jurisdiction: {
      name,
      parts: kept.map((p) => (p.type === 'field' ? { type: 'field', key: p.key, value: p.value } : { type: 'body', text: p.text })),
    },
    trailing,
  }
}

export function parseComparison(content: string): ComparisonItem[] {
  const lines = content.split('\n')
  const sectionHasHeadings = lines.some((l) => /^###\s+/.test(l.trim()))
  const preamble: string[] = []
  const places: { name: string; lines: string[] }[] = []

  for (const raw of lines) {
    const start = matchJurisdictionStart(raw.trim(), sectionHasHeadings)
    if (start) places.push({ name: start.name, lines: [] })
    else if (places.length > 0) places[places.length - 1].lines.push(raw)
    else preamble.push(raw)
  }

  const items: ComparisonItem[] = []
  // Text before the first place is section prose, not dropped (Razor C2).
  const lead = proseFrom(preamble)
  if (lead) items.push({ type: 'prose', text: lead })
  for (const place of places) {
    const { jurisdiction, trailing } = parseJurisdictionLines(place.name, place.lines)
    items.push({ type: 'jurisdiction', jurisdiction })
    const after = proseFrom(trailing)
    if (after) items.push({ type: 'prose', text: after })
  }
  return items
}

// ---- Document fields ----

export interface DocumentField {
  label: string
  value: string
}


export type AccessLevel = 'public' | 'fippa' | 'council'

/**
 * The badge level an Access value states, or null. A value gets a badge only
 * when it IS a badge label (trimmed, trailing punctuation removed, any case):
 * "Public", "FIPPA Required", "Council Record". Anything else ("Public, online",
 * "Public: no", "Partly public") gets no badge and renders whole as a field, so
 * the badge never claims more or less than the text.
 */
export function detectAccess(text: string): AccessLevel | null {
  const value = text.trim().replace(/[\s.,;:!?]+$/, '').toLowerCase()
  if (value === 'fippa required') return 'fippa'
  if (value === 'council record') return 'council'
  if (value === 'public') return 'public'
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

// ---- What Governs This: blocks to documents, eyebrows and prose. D2 owns this; the goldens are the contract. ----

export type GoverningBlock =
  | { type: 'document'; name: string; intro: string; fields: DocumentField[]; isPrimary: boolean }
  | { type: 'eyebrow'; text: string }
  | { type: 'prose'; text: string }

const DOCUMENT_FIELD_LINE = /^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/

/**
 * One block's fields, and the text around them that is not a field: `lead`
 * (before the first field) and `trailing` (after the last field, past a blank
 * line). A field value continues on the following non-field lines; text after
 * a blank line joins the field before it only when another field follows.
 */
function readDocumentBlock(lines: string[]): { lead: string[]; fields: DocumentField[]; trailing: string[] } {
  const lead: string[] = []
  const fields: DocumentField[] = []
  let pending: string[] = []
  for (const line of lines) {
    const match = line.match(DOCUMENT_FIELD_LINE)
    if (match) {
      if (fields.length > 0 && pending.some((l) => l.trim())) {
        fields[fields.length - 1].value += ' ' + pending.filter((l) => l.trim()).map((l) => l.trim()).join(' ')
      }
      pending = []
      fields.push({ label: match[1].trim(), value: match[2].trim() })
    } else if (fields.length === 0) {
      lead.push(line)
    } else if (line.trim() && pending.length === 0) {
      fields[fields.length - 1].value += ' ' + line.trim()
    } else {
      pending.push(line)
    }
  }
  return { lead, fields, trailing: pending }
}

/**
 * A block with fields is a document card; its name comes from a leading `###`
 * or bold-only line, else from its Document name field. A `###` or bold-only
 * line with no fields under it is a group label (an eyebrow), never a card,
 * and any text under it is prose. A block with no heading and no fields is
 * prose. isPrimary goes to the first document, not to block 0 (which is often
 * a lead-in sentence). Nothing is dropped (Razor C2): text between a heading
 * and its first field is the card's intro; text before the first field of a
 * block with no heading is prose before the card; text after the last field,
 * past a blank line, is prose after it.
 */
export function parseGoverningDocuments(content: string): GoverningBlock[] {
  const out: GoverningBlock[] = []
  let primaryTaken = false

  for (const block of splitDocumentBlocks(content)) {
    const lines = block.split('\n')
    const firstLine = lines[0]?.trim() ?? ''

    let heading: string | null = null
    if (firstLine.startsWith('###')) {
      heading = firstLine.replace(/^###\s*/, '').trim()
    } else if (firstLine.startsWith('**') && firstLine.endsWith('**') && !firstLine.match(/^[-*]\s+\*\*/)) {
      // A line wholly in bold: the bold is the heading's, not the name's.
      heading = firstLine.match(/^\*\*([^*]+)\*\*$/)?.[1].trim() ?? firstLine
    }

    const { lead, fields, trailing } = readDocumentBlock(heading === null ? lines : lines.slice(1))

    if (fields.length === 0) {
      if (heading === null) {
        out.push({ type: 'prose', text: block })
        continue
      }
      const label = heading.replace(/\*\*/g, '').trim()
      if (label) out.push({ type: 'eyebrow', text: label })
      const rest = lines.slice(1).join('\n').trim()
      if (rest) out.push({ type: 'prose', text: rest })
      continue
    }

    const leadText = proseFrom(lead) ?? ''
    let intro = ''
    if (heading !== null) intro = leadText
    else if (leadText) out.push({ type: 'prose', text: leadText })

    let name = heading ?? ''
    let docFields = fields
    if (!name) {
      const nameField = fields.find(
        (f) => f.label.toLowerCase() === 'document name' || f.label.toLowerCase() === 'document'
      )
      if (nameField) {
        name = nameField.value
        docFields = fields.filter((f) => f !== nameField)
      }
    }

    out.push({ type: 'document', name, intro, fields: docFields, isPrimary: !primaryTaken })
    primaryTaken = true
    const after = proseFrom(trailing)
    if (after) out.push({ type: 'prose', text: after })
  }

  return out
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
