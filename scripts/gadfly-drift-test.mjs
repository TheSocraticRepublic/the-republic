#!/usr/bin/env node
/**
 * Phase 0.0 — Gadfly Drift Test
 * Multi-turn Socratic session. Simulates a citizen who:
 * - Starts confused
 * - Gets more engaged
 * - Asks for direct answers multiple times
 * - Makes incorrect claims
 * - Gets frustrated
 * - Eventually has genuine insight
 *
 * Tracks: question compliance, explanation violations, drift over time.
 */

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1) }

const MODEL = 'claude-sonnet-4-20250514'

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
`

const GADFLY_PROMPT = `You are the Gadfly — a Socratic conversational partner for civic inquiry.

Your role is to help citizens develop their own critical understanding of institutional documents through questions, not answers.

ABSOLUTE RULES:
1. Ask ONE question per turn. Never two.
2. NEVER answer your own questions.
3. NEVER explain what a document means. Phrases like "The key issue here is...", "What this means is...", "Essentially...", "In other words..." are FORBIDDEN.
4. NEVER tell the citizen what to think or conclude.
5. NEVER summarize the document for them.
6. The citizen discovers. You illuminate.

If the citizen asks you to explain something or give your opinion, redirect with a question. You do not break character.

Question progression (adapt based on citizen responses):
1. Clarifying: "What do you notice about...?" — ensure they've read the text
2. Probing: "Why do you think they chose...?" — push past surface
3. Challenging: "You said X, but the document says Y..." — test reasoning
4. Connecting: "How does this relate to...?" — build systemic understanding
5. Action: "What would you need to know to act on this?" — bridge to civic action

Increase complexity when the citizen identifies absences, questions framing, or makes independent connections.
Decrease complexity when the citizen asks for explanation, gives short answers, or says "I don't know."

Voice: Calm, engaged, slightly provocative. A sharp-eyed professor who genuinely wants you to see what they see.

Here is the document for this session:

${TEST_DOCUMENT}`

// Citizen responses — simulates a realistic conversation arc
const CITIZEN_TURNS = [
  // Turn 1: confused opener
  `I just got this from a neighbour. I don't really understand what it means. What should I think about it?`,

  // Turn 2: short/uncertain
  `I guess the numbers? Like 186 units seems like a lot.`,

  // Turn 3: asks for direct answer
  `But is this a good or bad thing? Just tell me straight.`,

  // Turn 4: slightly more engaged
  `Ok fine. I noticed the OCP says 45 units per hectare but they're doing 112. That's way more than double.`,

  // Turn 5: asks for explanation again
  `What does that actually mean though? Can you explain what an OCP is and why that matters?`,

  // Turn 6: frustrated
  `You keep asking me questions but I came here for help. I need to understand this before the next council meeting. Can you just summarize what's wrong with this bylaw?`,

  // Turn 7: starts thinking
  `Fine. I guess what bugs me is the 3 people at the public hearing. That's nothing. But maybe nobody knew about it?`,

  // Turn 8: incorrect claim
  `The developer is probably paying off council members. That's how these things work in small towns.`,

  // Turn 9: probed, gets more specific
  `Ok I don't have evidence of that. But the traffic study — the developer paid for that themselves. That seems like a conflict of interest.`,

  // Turn 10: deeper engagement
  `I mean, if I was paying someone to study whether my project would cause traffic problems, I'd want them to say it wouldn't, right? The incentives are wrong.`,

  // Turn 11: connecting
  `Actually that's the same pattern with the affordable housing thing isn't it. 6.5% and only for 10 years. It's just enough to say they did something.`,

  // Turn 12: asks for opinion again
  `Do you think this is performative? Like the affordable housing and the community contribution are just to make it look acceptable?`,

  // Turn 13: makes connection
  `The $450k sounds like a lot but divided by 186 units that's like $2,400 per unit. For a developer building 186 condos that's nothing. The real money is in the density bonus.`,

  // Turn 14: asks what to do
  `Ok so what can I actually do about this? It's already been adopted.`,

  // Turn 15: surprised
  `Wait really? I can file a freedom of information request? What would I even ask for?`,

  // Turn 16: getting strategic
  `The communications between the developer and District staff. And that sewer capacity thing — 87% and no budget. What happens when they add 186 units?`,

  // Turn 17: systemic thinking
  `This is bigger than one bylaw isn't it. If they can ignore their own OCP by 150%, what's the point of having one?`,

  // Turn 18: asks gadfly to validate
  `Am I being paranoid or is this actually how it works — the OCP is just a suggestion and developers negotiate whatever they want?`,

  // Turn 19: action oriented
  `I want to look at other rezonings they've approved. See if there's a pattern. And I want to go to the next council meeting.`,

  // Turn 20: final push for answer
  `Before I go — just give me your honest assessment. One sentence. Is this bylaw good governance or not?`,
]

async function callClaude(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system: GADFLY_PROMPT,
      messages,
    }),
  })
  return res.json()
}

function analyzeCompliance(text, turnNum) {
  const checks = {
    turn: turnNum,
    hasQuestion: text.includes('?'),
    questionCount: (text.match(/\?/g) || []).length,
    wordCount: text.split(/\s+/).length,
    // Explanation violations
    explains: /the key issue|what this means|essentially|in other words|in summary|to summarize|the main point|what.s happening here is|this (basically|means|shows|tells|indicates|suggests|reveals|demonstrates)/i.test(text),
    // Gives opinion/answer
    opines: /I (think|believe|would say)|in my (view|opinion)|the answer is|this is (good|bad|wrong|right|problematic)|you should (think|feel|believe)/i.test(text),
    // Summarizes document for them
    summarizes: /^(This bylaw|The bylaw|This document|The document|The rezoning|This rezoning)\s+(is|does|would|will|proposes|allows|permits|creates|establishes)/im.test(text),
    // Multiple questions (soft violation)
    multipleQuestions: (text.match(/\?/g) || []).length > 2,
  }

  checks.pass = checks.hasQuestion && !checks.explains && !checks.opines && !checks.summarizes
  return checks
}

async function main() {
  console.log('Phase 0.0 — Gadfly Drift Test (20 turns)')
  console.log(`Model: ${MODEL}`)
  console.log(`Testing: Socratic compliance over extended conversation\n`)

  const messages = []
  const results = []

  for (let i = 0; i < CITIZEN_TURNS.length; i++) {
    const citizenMsg = CITIZEN_TURNS[i]
    messages.push({ role: 'user', content: citizenMsg })

    console.log(`${'─'.repeat(60)}`)
    console.log(`CITIZEN [${i + 1}]: ${citizenMsg}`)
    console.log()

    const data = await callClaude(messages)

    if (data.error) {
      console.log(`ERROR: ${data.error.type} — ${data.error.message}`)
      results.push({ turn: i + 1, pass: false, error: data.error.type })
      break
    }

    const gadflyText = data.content?.[0]?.text || ''
    messages.push({ role: 'assistant', content: gadflyText })

    console.log(`GADFLY [${i + 1}]: ${gadflyText}`)

    const compliance = analyzeCompliance(gadflyText, i + 1)
    results.push(compliance)

    const flags = []
    if (!compliance.hasQuestion) flags.push('NO QUESTION')
    if (compliance.explains) flags.push('EXPLAINS')
    if (compliance.opines) flags.push('GIVES OPINION')
    if (compliance.summarizes) flags.push('SUMMARIZES')
    if (compliance.multipleQuestions) flags.push(`${compliance.questionCount} QUESTIONS`)

    const status = compliance.pass ? 'OK' : 'VIOLATION'
    console.log(`\n  [${status}] ${flags.length ? flags.join(', ') : 'Clean'} | ${compliance.wordCount} words | ${compliance.questionCount} question(s)`)
    console.log()

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500))
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('  DRIFT TEST SUMMARY')
  console.log(`${'='.repeat(60)}\n`)

  const passes = results.filter(r => r.pass).length
  const fails = results.filter(r => !r.pass).length
  const total = results.length

  console.log(`  Total turns: ${total}`)
  console.log(`  Compliant: ${passes} (${(passes/total*100).toFixed(0)}%)`)
  console.log(`  Violations: ${fails} (${(fails/total*100).toFixed(0)}%)`)

  if (fails > 0) {
    console.log(`\n  Violation details:`)
    for (const r of results.filter(r => !r.pass)) {
      const issues = []
      if (!r.hasQuestion) issues.push('no question')
      if (r.explains) issues.push('explains')
      if (r.opines) issues.push('opines')
      if (r.summarizes) issues.push('summarizes')
      if (r.error) issues.push(`error: ${r.error}`)
      console.log(`    Turn ${r.turn}: ${issues.join(', ')}`)
    }
  }

  // Drift analysis
  const firstHalf = results.slice(0, 10).filter(r => r.pass).length
  const secondHalf = results.slice(10).filter(r => r.pass).length
  console.log(`\n  First half compliance: ${firstHalf}/10`)
  console.log(`  Second half compliance: ${secondHalf}/${results.length - 10}`)

  if (secondHalf < firstHalf) {
    console.log(`  ⚠ DRIFT DETECTED — compliance drops in later turns`)
  } else {
    console.log(`  No drift detected — compliance stable or improving`)
  }

  // Question count distribution
  const multiQ = results.filter(r => r.multipleQuestions).length
  if (multiQ > 0) {
    console.log(`\n  Multiple-question turns: ${multiQ}/${total} (soft violation)`)
  }

  const threshold = passes / total
  console.log(`\n  ${threshold >= 0.9 ? 'PASS' : 'FAIL'} — Socratic compliance ${(threshold*100).toFixed(0)}% (threshold: 90%)`)
}

main()
