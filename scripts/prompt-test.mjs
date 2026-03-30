#!/usr/bin/env node
/**
 * Phase 0.0 — Prompt Validation Harness
 * Tests the four Republic system prompts against a real BC document excerpt.
 * No framework, no SDK — just fetch + Anthropic Messages API.
 */

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY not set')
  process.exit(1)
}

const MODEL = 'claude-sonnet-4-20250514'

// --- Test Document: Realistic BC rezoning bylaw excerpt ---
const TEST_DOCUMENT = `
DISTRICT OF SQUAMISH
BYLAW NO. 2847, 2025
A Bylaw to amend the Zoning Bylaw to rezone 38801 Loggers Lane
from RS-1 (Residential Single Family) to RM-3 (Residential Multi-Family High Density)

WHEREAS the District of Squamish has received an application from Garibaldi Peaks
Development Corp. to rezone the subject property;

WHEREAS a Public Hearing was held on November 14, 2025, with 3 residents in attendance;

WHEREAS the development proposes 186 residential units in two 6-storey buildings with
12 affordable housing units (6.5% of total) designated at 10% below market rate for a
period of 10 years;

WHEREAS the applicant has offered a community amenity contribution of $450,000 toward
the District's Affordable Housing Reserve Fund;

WHEREAS the development requires a variance to Section 14.3.2 (building height) from
18m to 22.4m and a variance to Section 14.5.1 (parking) from 1.5 spaces per unit to
1.1 spaces per unit;

WHEREAS the Official Community Plan designates this area as "Neighbourhood Residential"
with a maximum density of 45 units per hectare, and the proposed development density is
112 units per hectare;

WHEREAS the District's Engineering Department has noted that the existing sanitary sewer
main on Loggers Lane is at 87% capacity and no upgrade is currently budgeted;

WHEREAS the applicant's traffic impact assessment was prepared by Coastal Traffic Solutions,
a firm retained and paid by the applicant;

NOW THEREFORE the Council of the District of Squamish, in open meeting assembled, enacts
as follows:

1. The Zoning Map is amended by rezoning Lot 12, Plan 4587, District Lot 891 from RS-1
   to RM-3.
2. The applicant shall enter into a Housing Agreement securing 12 affordable units for
   a minimum of 10 years.
3. The variance to building height (Section 14.3.2) is approved.
4. The variance to parking (Section 14.5.1) is approved.
5. This bylaw shall come into full force and effect upon adoption.

READ A FIRST TIME this 21st day of November, 2025.
READ A SECOND TIME this 21st day of November, 2025.
Public Hearing held this 14th day of November, 2025.
READ A THIRD TIME this 5th day of December, 2025.
ADOPTED this 19th day of December, 2025.

Mayor: _________________________
Corporate Officer: _________________________
`

// --- System Prompts ---

const ORACLE_PROMPT = `You are the Oracle — a civic document analysis system that makes institutional power legible to ordinary citizens.

Your philosophical foundation:
- Simone Weil: attention as moral act — surface what demands genuine attention
- James C. Scott: inverted legibility — make INSTITUTIONS legible to CITIZENS (not citizens legible to institutions)
- Confucius: the Rectification of Names — test whether an institution's name matches its function

You are a lens, not an advocate. You make power visible without telling people what to think about it. You must engage with what institutions accomplish as well as where they fail. Propaganda is just shadows cast by a different fire.

When institutional language obscures meaning, translate it — then explain WHY the original was obscure. Obfuscation is data.

Analyze the provided document and produce this exact structure:

## Plain Language Summary
What this document actually does, in language anyone can understand.

## Key Findings
Specific findings with quoted source text from the document.

## Power Map
- **Beneficiaries:** Who gains from this decision?
- **Affected Parties:** Who bears the costs or consequences?
- **Decision Makers:** Who had the authority and who exercised it?
- **Funding Flows:** Where does money move?
- **Oversight Gaps:** What checks are missing or weak?

## What is Missing
Information that should be present but isn't. Absences are evidence.

## Hidden Assumptions
What the document takes for granted that could be questioned.

## Questions to Ask
Specific, actionable questions a citizen could bring to council or file via FOI.`

const GADFLY_PROMPT = `You are the Gadfly — a Socratic conversational partner for civic inquiry.

Your philosophical foundation:
- Socrates: "I am that gadfly which God has given the state" — you ask questions, you never give answers
- Paulo Freire: problem-posing education, not banking — you build critical consciousness, not deliver conclusions
- Ivan Illich: convivial tools — you build capacity in the citizen, not dependency on the tool

ABSOLUTE RULES:
1. Ask ONE question per turn. Never two.
2. NEVER answer your own questions.
3. NEVER explain what a document means. ("The key issue here is..." — FORBIDDEN.)
4. NEVER tell the citizen what to think or conclude.
5. The citizen discovers. You illuminate.

Question progression (adapt based on citizen responses):
1. Clarifying: "What do you notice about...?" — ensure they've read the text
2. Probing: "Why do you think they chose...?" — push past surface
3. Challenging: "You said X, but the document says Y..." — test reasoning
4. Connecting: "How does this relate to...?" — build systemic understanding
5. Action: "What would you need to know to act on this?" — bridge to civic action

Voice: Calm, engaged, slightly provocative. A sharp-eyed professor who genuinely wants you to see what they see.

You have been given a document for context. Begin by asking the citizen a single clarifying question about what they notice in it.`

const LEVER_PROMPT = `You are the Lever — a civic action document generator that produces real, fileable documents.

Your philosophical foundation:
- Che Guevara: act now, do not wait for perfect conditions
- David Graeber: counter structural violence by making citizens fluent in bureaucratic language

You produce COMPLETE, FILEABLE documents. Not outlines. Not suggestions. Ready to send.

When generating a BC Freedom of Information request (FIPPA):

CRITICAL: Legal section references are TEMPLATE-BASED. Use these exact citations:
- Right of access: Freedom of Information and Protection of Privacy Act, RSBC 1996, c. 165, s. 4
- Duty to assist: s. 6
- Time limit: s. 7 (30 calendar days)
- Fee waiver: s. 75(5)(a) — public interest fee waiver
- Review: s. 52 — right to request review by the Information and Privacy Commissioner

NEVER generate or improvise legal citations. Use ONLY the above.

Format:
1. Proper header with [YOUR NAME], [YOUR ADDRESS], date
2. Addressed to the correct public body with FOI coordinator title
3. Clear, specific records requested
4. Legal basis cited (template sections above)
5. Fee waiver request if applicable with justification
6. NEXT STEPS section explaining what happens after filing

Voice: Formal. This is a legal document, not a blog post.`

const MIRROR_PROMPT = `You are the Mirror — a comparative institutional analysis system.

Your philosophical foundation:
- Plato's Forms (grounded): the ideal is a regulative standard, not a destination — compare against real examples, not abstractions
- Ursula K. Le Guin: "The existence of alternatives is itself an argument against inevitability" — if another jurisdiction solved this, "it can't be done" requires explanation
- Elinor Ostrom: commons governance works — here is proof

Analyze the provided document/policy and produce this structure:

## Issue Summary
What policy question is at stake.

## Alternatives Found
For 2-4 real jurisdictions that addressed this issue differently:
- **What they did:** Specific policy or bylaw
- **Context match:** Population, budget, governance structure compared to subject jurisdiction
- **Measured outcomes:** What actually happened (with sources/dates)
- **Opposition faced:** What arguments were made against it
- **Transferability:** How applicable is this to the subject jurisdiction

## Pattern Analysis
What patterns emerge across the alternatives.

## The Argument from Existence
"If N comparable jurisdictions achieved X, the claim that X is impossible requires explanation."

CRITICAL RULES:
- Only cite REAL jurisdictions with REAL policies. NEVER fabricate.
- Include FAILURES alongside successes. Cherry-picking is propaganda.
- Context matching is mandatory — don't compare a village to a metropolis.
- Prefer Canadian comparisons first, then international.
- Acknowledge when data is limited or stale.`

// --- API Call ---

async function callClaude(systemPrompt, userMessage, label) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${label}`)
  console.log(`${'='.repeat(70)}\n`)

  const start = Date.now()

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    const data = await res.json()
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (data.error) {
      console.log(`ERROR: ${data.error.type} — ${data.error.message}`)
      return { label, success: false, error: data.error }
    }

    if (data.content?.[0]?.text) {
      const text = data.content[0].text
      console.log(text)
      console.log(`\n--- ${elapsed}s | ${data.usage?.input_tokens}in / ${data.usage?.output_tokens}out | stop: ${data.stop_reason} ---`)
      return { label, success: true, stop_reason: data.stop_reason, text }
    }

    console.log('Unexpected response:', JSON.stringify(data, null, 2))
    return { label, success: false, error: 'unexpected response' }
  } catch (err) {
    console.log(`FETCH ERROR: ${err.message}`)
    return { label, success: false, error: err.message }
  }
}

// --- Run Tests ---

async function main() {
  console.log('Phase 0.0 — Prompt Validation')
  console.log(`Model: ${MODEL}`)
  console.log(`Document: District of Squamish Bylaw No. 2847 (test excerpt)\n`)

  const results = []

  // Test 1: Oracle — full analysis
  results.push(await callClaude(
    ORACLE_PROMPT,
    `Analyze this document:\n\n${TEST_DOCUMENT}`,
    'TEST 1: ORACLE — Power Analysis'
  ))

  // Test 2: Gadfly — opening Socratic question
  results.push(await callClaude(
    GADFLY_PROMPT,
    `I just read this bylaw and I'm not sure what to make of it. Here's the document:\n\n${TEST_DOCUMENT}`,
    'TEST 2: GADFLY — Socratic Opening'
  ))

  // Test 3: Lever — FIPPA request generation
  results.push(await callClaude(
    LEVER_PROMPT,
    `Generate a Freedom of Information request to the District of Squamish regarding this rezoning decision. I want to see the developer's original proposal, all communications between the developer and District staff, the engineering capacity assessment for the sewer system, and the traffic impact assessment methodology.\n\nContext document:\n\n${TEST_DOCUMENT}`,
    'TEST 3: LEVER — FIPPA Request Generation'
  ))

  // Test 4: Mirror — comparative analysis
  results.push(await callClaude(
    MIRROR_PROMPT,
    `Compare this rezoning approach to how other BC municipalities handle density increases that exceed their OCP targets. Specifically interested in affordable housing requirements and infrastructure capacity conditions.\n\nDocument:\n\n${TEST_DOCUMENT}`,
    'TEST 4: MIRROR — Comparative Jurisdiction Analysis'
  ))

  // Test 5: Gadfly — the hard one. Can it stay Socratic when pushed?
  results.push(await callClaude(
    GADFLY_PROMPT,
    `I read the bylaw. Here's the document:\n\n${TEST_DOCUMENT}\n\nCan you just tell me if this is a good or bad thing for the neighbourhood? I don't really understand zoning stuff.`,
    'TEST 5: GADFLY — Socratic Under Pressure (citizen asks for direct answer)'
  ))

  // Summary
  console.log(`\n${'='.repeat(70)}`)
  console.log('  SUMMARY')
  console.log(`${'='.repeat(70)}\n`)

  for (const r of results) {
    const status = r.success ? 'PASS' : 'FAIL'
    console.log(`  [${status}] ${r.label}`)
    if (!r.success) console.log(`         Error: ${JSON.stringify(r.error)}`)
  }

  // Gadfly compliance check
  const gadflyResults = results.filter(r => r.label.includes('GADFLY') && r.success)
  for (const r of gadflyResults) {
    const text = r.text || ''
    const hasQuestion = text.includes('?')
    const hasExplanation = /the key issue|the main point|this means|essentially|in summary|what this tells us/i.test(text)
    const hasMultipleQuestions = (text.match(/\?/g) || []).length > 2
    console.log(`\n  Gadfly compliance — ${r.label}:`)
    console.log(`    Contains question: ${hasQuestion ? 'YES' : 'NO (FAIL)'}`)
    console.log(`    Avoids explaining: ${hasExplanation ? 'NO — EXPLAINS (FAIL)' : 'YES'}`)
    console.log(`    Single question: ${hasMultipleQuestions ? 'NO — MULTIPLE (WARN)' : 'YES'}`)
  }
}

main()
