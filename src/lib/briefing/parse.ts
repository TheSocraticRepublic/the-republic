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

export function preprocessBlocks(content: string): BlockElement[] {
  const result: BlockElement[] = []

  // Split into raw paragraphs first (blank-line separated)
  const rawParagraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  for (const para of rawParagraphs) {
    // --- separator → hr (only when it's JUST "---" on its own, not inside other text)
    if (/^---\s*$/.test(para)) {
      result.push({ type: 'hr' })
      continue
    }

    // ### Sub-heading
    if (para.match(/^###\s+/)) {
      const text = para.replace(/^###\s+/, '').replace(/\*\*/g, '').trim()
      result.push({ type: 'subheading', text })
      continue
    }

    // Bullet/numbered list paragraph
    if (para.match(/^[-*]\s+/m) || para.match(/^\d+[.)]\s+/m)) {
      const lines = para.split('\n').filter((l) => l.trim())
      const items = lines.map((l) => l.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
      result.push({ type: 'list', items })
      continue
    }

    // Bold-only line (no colon) → treat as sub-heading
    // Must be a single line, wrapped entirely in **, no colon inside
    const boldOnlyMatch = para.match(/^\*\*([^*:]+)\*\*\s*$/)
    if (boldOnlyMatch && !para.includes('\n')) {
      result.push({ type: 'subheading', text: boldOnlyMatch[1].trim() })
      continue
    }

    result.push({ type: 'paragraph', text: para })
  }

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
  if (r.includes('nation')) return 'indigenous'
  return 'other'
}

export function parsePlayers(content: string): PlayerData[] {
  const players: PlayerData[] = []

  const lines = content.split('\n').map((l) => l.replace(/^\s*[-*]\s+/, '').trim()).filter((l) => l && !/^-{2,}$/.test(l))

  const fieldLabels = /^(?:\*\*)?(?:role|why they matter|track record|what they do|how they relate)(?:\*\*)?[:\s]/i

  let current: { name: string; role: string; whyTheyMatter: string; trackRecord: string } | null = null

  for (const line of lines) {
    const cleanLine = line.replace(/\*\*/g, '')

    if (!fieldLabels.test(cleanLine) && !cleanLine.startsWith('Role:')) {
      if (current && current.name) players.push({ ...current })
      current = { name: cleanLine, role: '', whyTheyMatter: '', trackRecord: '' }
      continue
    }

    if (!current) continue

    const roleMatch = cleanLine.match(/^(?:role)[:\s]+(.+)/i)
    if (roleMatch) { current.role = roleMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }

    const whyMatch = cleanLine.match(/^(?:why they matter)[:\s]+(.+)/i)
    if (whyMatch) { current.whyTheyMatter = whyMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }

    const trackMatch = cleanLine.match(/^(?:track record)[:\s]+(.+)/i)
    if (trackMatch) { current.trackRecord = trackMatch[1].replace(/^[-\s]+|[-\s]+$/g, ''); continue }
  }

  if (current && current.name) players.push({ ...current })

  return players
}

export interface JurisdictionData {
  name: string
  whatTheyDid: string
  whyItMatters: string
  outcome: string
}

export function parseJurisdictions(content: string): JurisdictionData[] {
  const jurisdictions: JurisdictionData[] = []

  // Split on ### headings or **Bold Name** delimiters
  const blocks = content.split(/(?=^###\s+|^\*\*[^*]+\*\*\s*$)/m).filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    // Extract jurisdiction name from heading or bold text
    let name = ''
    const h3Match = lines[0].match(/^###\s+(.+)/)
    const boldMatch = lines[0].match(/^\*\*(.+?)\*\*/)
    if (h3Match) name = h3Match[1].replace(/\*\*/g, '').trim()
    else if (boldMatch) name = boldMatch[1].trim()
    else continue

    const restLines = lines.slice(1)
    const restText = restLines.join('\n')

    // Try structured field extraction
    let whatTheyDid = ''
    let whyItMatters = ''
    let outcome = ''

    // Capture only the VALUE after the label — handle optional trailing words like "differently", "for you"
    const whatMatch = restText.match(/(?:\*\*)?[Ww]hat\s+they\s+did(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+?)(?=(?:\*\*)?(?:[Ww]hy\s+it|[Oo]utcome|$))/i)
    if (whatMatch) whatTheyDid = whatMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    const whyMatch = restText.match(/(?:\*\*)?[Ww]hy\s+it\s+matters(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+?)(?=(?:\*\*)?(?:[Oo]utcome|$))/i)
    if (whyMatch) whyItMatters = whyMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    const outcomeMatch = restText.match(/(?:\*\*)?[Oo]utcome(?:\s+\w+)?(?:\*\*)?[:\s]+([\s\S]+)/i)
    if (outcomeMatch) outcome = outcomeMatch[1].replace(/\*\*/g, '').replace(/^[-\s]+|[-\s]+$/g, '').trim()

    // Fallback: split paragraphs positionally
    if (!whatTheyDid && !whyItMatters) {
      const paras = restText.split(/\n{2,}/).map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean)
      if (paras.length >= 1) whatTheyDid = paras[0]
      if (paras.length >= 2) whyItMatters = paras[1]
      if (paras.length >= 3) outcome = paras[2]
    }

    if (name) {
      jurisdictions.push({ name, whatTheyDid, whyItMatters, outcome })
    }
  }

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
