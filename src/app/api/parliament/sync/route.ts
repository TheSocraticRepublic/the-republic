import { NextRequest } from 'next/server'
import { syncParliamentData } from '@/lib/parliament/sync'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { session?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — use defaults
  }

  const session = body.session || '45-1'

  try {
    const result = await syncParliamentData(session)

    return new Response(JSON.stringify({ result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[parliament/sync] Sync failed:', err)
    return new Response(
      JSON.stringify({
        error: 'Sync failed',
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
