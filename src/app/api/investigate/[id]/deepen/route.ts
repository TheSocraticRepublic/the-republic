import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, players, investigationPlayers, playerTypeEnum, investigationPlayerRoleEnum } from '@/lib/db/schema'
import { LENS_CONTEXT_SYSTEM_PROMPT } from '@/lib/ai/prompts/lens-context-system'
import { PLAYER_EXTRACTION_SYSTEM_PROMPT } from '@/lib/ai/prompts/player-extraction-system'
import { anthropic } from '@ai-sdk/anthropic'
import { streamText, generateText } from 'ai'
import { eq, and } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params

  const db = getDb()

  // Fetch investigation with ownership check
  const [investigation] = await db
    .select()
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!investigation.briefingText) {
    return new Response(JSON.stringify({ error: 'Briefing not yet complete' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Update lensOpenedAt (scoped to this user to prevent cross-user writes)
  if (!investigation.lensOpenedAt) {
    await db.update(investigations)
      .set({ lensOpenedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
  }

  // Fire player extraction in background (non-blocking)
  extractPlayers(db, id, investigation.briefingText).catch((err) => {
    console.error('Player extraction failed for investigation', id, err)
  })

  // Stream historical context
  const result = streamText({
    model: anthropic(MODEL),
    system: LENS_CONTEXT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Investigation concern: ${investigation.concern}\n\nJurisdiction: ${investigation.jurisdictionName || 'Not specified'}\n\nBriefing analysis:\n${investigation.briefingText}`,
    }],
  })

  return result.toTextStreamResponse()
}

// Background player extraction
async function extractPlayers(
  db: ReturnType<typeof getDb>,
  investigationId: string,
  briefingText: string
) {
  const { text } = await generateText({
    model: anthropic(MODEL),
    system: PLAYER_EXTRACTION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: briefingText,
    }],
  })

  // Parse the JSON response
  let extractedPlayers: Array<{
    name: string
    playerType: string
    role: string
    context: string
    description: string
  }>

  try {
    // The LLM might wrap in markdown code block
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    extractedPlayers = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse player extraction response:', text.substring(0, 200))
    return
  }

  if (!Array.isArray(extractedPlayers) || extractedPlayers.length === 0) return

  // Upsert players and create junction records
  for (const ep of extractedPlayers) {
    // Validate playerType and role against the actual enum definitions in the schema
    const validPlayerTypes = playerTypeEnum.enumValues
    const validRoles = investigationPlayerRoleEnum.enumValues

    if (!validPlayerTypes.includes(ep.playerType as any)) continue
    if (!validRoles.includes(ep.role as any)) continue

    // Sanitize string fields: trim and cap lengths
    const name = (ep.name || '').trim().slice(0, 500)
    if (!name) continue
    const description = ep.description ? ep.description.trim().slice(0, 2000) : null
    const context = ep.context ? ep.context.trim().slice(0, 2000) : null

    // Check if player already exists
    const existing = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.name, name))
      .limit(1)

    let playerId: string

    if (existing.length > 0) {
      playerId = existing[0].id
    } else {
      const [newPlayer] = await db
        .insert(players)
        .values({
          name,
          playerType: ep.playerType as any, // validated above
          description,
        })
        .returning({ id: players.id })
      playerId = newPlayer.id
    }

    // Create junction record (ignore duplicate unique constraint violations only)
    try {
      await db.insert(investigationPlayers).values({
        investigationId,
        playerId,
        role: ep.role as any, // validated above
        context,
      })
    } catch (err: any) {
      // Only swallow unique constraint violations (PostgreSQL code 23505)
      if (err?.code !== '23505') {
        console.error('Failed to link player to investigation:', err)
      }
    }
  }
}
