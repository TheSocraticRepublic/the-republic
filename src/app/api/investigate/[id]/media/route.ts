import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { getDb } from '@/lib/db'
import { investigations, campaignMaterials, campaignMaterialTypeEnum, investigationPlayers, players } from '@/lib/db/schema'
import { buildCampaignPrompt } from '@/lib/ai/prompts/campaign-system'
import { campaignMaterialSchema } from '@/lib/campaign/schemas'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { eq, and } from 'drizzle-orm'

const MODEL = 'claude-sonnet-4-20250514'

// The valid materialTypes the campaign system can generate (subset of the DB enum)
const SUPPORTED_MATERIAL_TYPES = new Set([
  'infographic',
  'fact_sheet',
  'social_post',
  'talking_points',
  'timeline',
  'comparison',
])

// POST: Generate a campaign material spec
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

  // Parse request body
  let body: { materialType?: string; audience?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { materialType } = body

  // W-2: Validate audience against the allowed enum before injecting into the prompt
  const validAudiences = ['general_public', 'decision_maker', 'media', 'legal'] as const
  const audience = body.audience && (validAudiences as readonly string[]).includes(body.audience)
    ? body.audience
    : 'general_public'

  if (!materialType) {
    return new Response(JSON.stringify({ error: 'materialType is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Validate materialType against supported types (Zod discriminated union covers these)
  if (!SUPPORTED_MATERIAL_TYPES.has(materialType)) {
    return new Response(
      JSON.stringify({
        error: `Invalid materialType. Must be one of: ${[...SUPPORTED_MATERIAL_TYPES].join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Also validate against the DB enum values to catch drift
  const validDbTypes = campaignMaterialTypeEnum.enumValues
  if (!validDbTypes.includes(materialType as typeof validDbTypes[number])) {
    return new Response(
      JSON.stringify({ error: `materialType '${materialType}' is not a valid campaign_material_type` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

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
    return new Response(
      JSON.stringify({ error: 'Briefing must be complete before generating campaign materials' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Fetch players associated with this investigation for additional context
  const investigationPlayerRecords = await db
    .select({
      name: players.name,
      playerType: players.playerType,
      description: players.description,
      role: investigationPlayers.role,
      context: investigationPlayers.context,
    })
    .from(investigationPlayers)
    .innerJoin(players, eq(investigationPlayers.playerId, players.id))
    .where(eq(investigationPlayers.investigationId, id))

  // Build the user message with full investigation context
  const playerContext = investigationPlayerRecords.length > 0
    ? `\n\nKey players identified:\n${investigationPlayerRecords.map((p) =>
        `- ${p.name} (${p.playerType}, role: ${p.role})${p.description ? `: ${p.description}` : ''}${p.context ? ` — Context: ${p.context}` : ''}`
      ).join('\n')}`
    : ''

  const audienceContext = audience ? `\n\nTarget audience for this material: ${audience}` : ''

  const userMessage = [
    `Citizen concern: ${investigation.concern}`,
    `Jurisdiction: ${investigation.jurisdictionName || 'Not specified'}`,
    `\nBriefing analysis:\n${investigation.briefingText}`,
    playerContext,
    audienceContext,
    `\nGenerate a ${materialType} campaign material spec for this investigation.`,
    `The "investigationId" field must be: "${investigation.id}"`,
    `The "materialType" field must be: "${materialType}"`,
    `The "generatedAt" field must be: "${new Date().toISOString()}"`,
    `The "jurisdiction" field must include name: "${investigation.jurisdictionName || 'Not specified'}"`,
  ].join('\n')

  // Generate the spec — validate with Zod, retry once on failure
  const systemPrompt = buildCampaignPrompt(materialType)

  let parsed: ReturnType<typeof campaignMaterialSchema.parse>
  // C-2: Initialize to empty string so the retry block can safely check it
  let rawText = ''

  try {
    const { text } = await generateText({
      model: anthropic(MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    rawText = text

    // Strip any accidental markdown code fences
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const json = JSON.parse(cleaned)
    parsed = campaignMaterialSchema.parse(json)
  } catch (firstError: unknown) {
    // C-2: If generateText threw before rawText was assigned, we have nothing to retry with
    if (!rawText) {
      console.error('Campaign material generation failed before producing output:', firstError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate campaign material spec' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // C-1: Build a safe retry message — strip to field paths and error codes only.
    // Never include raw error message text (prompt injection vector).
    let safeErrorMessage: string
    if (firstError instanceof ZodError) {
      safeErrorMessage = firstError.issues.map((i) => `${i.path.join('.')}: ${i.code}`).join('; ')
    } else {
      safeErrorMessage = 'Invalid JSON. Return only a valid JSON object.'
    }

    try {
      const { text: retryText } = await generateText({
        model: anthropic(MODEL),
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
          {
            role: 'assistant',
            content: rawText,
          },
          {
            role: 'user',
            content: `Your previous response failed validation: ${safeErrorMessage}. Fix and return valid JSON.`,
          },
        ],
      })

      const cleaned = retryText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const json = JSON.parse(cleaned)
      parsed = campaignMaterialSchema.parse(json)
    } catch (retryError: unknown) {
      const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError)
      console.error('Campaign material generation failed after retry:', retryErrorMessage)
      return new Response(
        JSON.stringify({ error: 'Failed to generate campaign material spec' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Persist to campaign_materials table
  // The content column stores the full JSON spec as text
  // The reasoning column stores the top-level reasoning field
  const specJson = JSON.stringify(parsed)

  let savedMaterial: { id: string; createdAt: Date }
  try {
    const [inserted] = await db
      .insert(campaignMaterials)
      .values({
        investigationId: investigation.id,
        userId,
        materialType: materialType as typeof validDbTypes[number],
        title: parsed.title,
        content: specJson,
        reasoning: parsed.reasoning,
        format: 'json',
        status: 'draft',
      })
      .returning({ id: campaignMaterials.id, createdAt: campaignMaterials.createdAt })
    savedMaterial = inserted
  } catch (err) {
    console.error('Failed to persist campaign material', err)
    return new Response(
      JSON.stringify({ error: 'Failed to save campaign material' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      id: savedMaterial.id,
      createdAt: savedMaterial.createdAt,
      spec: parsed,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  )
}
