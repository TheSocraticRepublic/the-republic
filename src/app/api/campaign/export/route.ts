import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { campaignMaterials } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { campaignMaterialSchema } from '@/lib/campaign/schemas'
import { renderCampaignPdf, hasCampaignPdfTemplate } from '@/lib/pdf/render'
import { Readable } from 'stream'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/campaign/export
 *
 * Export a campaign material as PDF.
 *
 * Body: { materialId: string, format: 'pdf' }
 *
 * Returns a streamed application/pdf response with Content-Disposition attachment.
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { success } = await checkRateLimit(`campaign-export:${userId}`)
  if (!success) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { materialId: string; format: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { materialId, format } = body

  if (!materialId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(materialId)) {
    return new Response(JSON.stringify({ error: 'Valid materialId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (format !== 'pdf') {
    return new Response(
      JSON.stringify({ error: 'Only format "pdf" is supported at this endpoint' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const db = getDb()

  // Fetch the campaign material row
  const [row] = await db
    .select({
      id: campaignMaterials.id,
      materialType: campaignMaterials.materialType,
      title: campaignMaterials.title,
      content: campaignMaterials.content,
      userId: campaignMaterials.userId,
    })
    .from(campaignMaterials)
    .where(
      and(
        eq(campaignMaterials.id, materialId),
        eq(campaignMaterials.userId, userId)
      )
    )
    .limit(1)

  if (!row) {
    return new Response(JSON.stringify({ error: 'Material not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify this material type has a PDF template
  if (!hasCampaignPdfTemplate(row.materialType)) {
    return new Response(
      JSON.stringify({
        error: `PDF export is not available for material type: ${row.materialType}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Parse the content JSON through the campaign material schema
  let parsed
  try {
    const raw = JSON.parse(row.content)
    parsed = campaignMaterialSchema.parse(raw)
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Failed to parse campaign material content',
        details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : 'Unknown error') : undefined,
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Render the PDF
  try {
    const nodeStream = await renderCampaignPdf(parsed)
    const webStream = nodeReadableToWebReadable(nodeStream)

    const date = new Date().toISOString().slice(0, 10)
    const filename = `${row.materialType}-${date}.pdf`

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[campaign/export] PDF render failed:', err)
    return new Response(
      JSON.stringify({
        error: 'PDF rendering failed',
        details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : 'Unknown error') : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Convert a Node.js ReadableStream to a Web ReadableStream for Next.js Response.
 */
function nodeReadableToWebReadable(
  nodeStream: NodeJS.ReadableStream
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk: Buffer | string) => {
        controller.enqueue(
          chunk instanceof Buffer ? new Uint8Array(chunk) : new TextEncoder().encode(chunk as string)
        )
      })
      nodeStream.on('end', () => {
        controller.close()
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
      })
    },
    cancel() {
      if ('destroy' in nodeStream && typeof nodeStream.destroy === 'function') {
        ;(nodeStream as Readable).destroy()
      }
    },
  })
}
