import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { investigations, campaignMaterials } from '@/lib/db/schema'
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_DESCRIPTIONS } from '@/lib/campaign/schemas'
import { eq, and } from 'drizzle-orm'

// POST: Initialize campaign — update campaignOpenedAt (idempotent), return available material types
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

  // Mark campaign as opened (idempotent — same pattern as lensOpenedAt)
  if (!investigation.campaignOpenedAt) {
    await db.update(investigations)
      .set({ campaignOpenedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
  }

  // Return available material types with labels and descriptions
  const materialTypes = Object.keys(MATERIAL_TYPE_LABELS).map((type) => ({
    type,
    label: MATERIAL_TYPE_LABELS[type as keyof typeof MATERIAL_TYPE_LABELS],
    description: MATERIAL_TYPE_DESCRIPTIONS[type as keyof typeof MATERIAL_TYPE_DESCRIPTIONS],
  }))

  return new Response(
    JSON.stringify({
      campaignOpenedAt: investigation.campaignOpenedAt ?? new Date().toISOString(),
      materialTypes,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

// GET: Return existing campaign materials for this investigation
export async function GET(
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

  // Verify ownership
  const [investigation] = await db
    .select({ id: investigations.id, campaignOpenedAt: investigations.campaignOpenedAt })
    .from(investigations)
    .where(and(eq(investigations.id, id), eq(investigations.userId, userId)))
    .limit(1)

  if (!investigation) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch all campaign materials for this investigation
  const materials = await db
    .select({
      id: campaignMaterials.id,
      materialType: campaignMaterials.materialType,
      title: campaignMaterials.title,
      content: campaignMaterials.content,
      reasoning: campaignMaterials.reasoning,
      format: campaignMaterials.format,
      status: campaignMaterials.status,
      createdAt: campaignMaterials.createdAt,
      updatedAt: campaignMaterials.updatedAt,
    })
    .from(campaignMaterials)
    .where(and(
      eq(campaignMaterials.investigationId, id),
      eq(campaignMaterials.userId, userId)
    ))

  return new Response(
    JSON.stringify({
      campaignOpenedAt: investigation.campaignOpenedAt,
      materials,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
