import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  validateDisplayName,
  validateBio,
  stripHtmlTags,
  canChangeDisplayName,
} from '@/lib/profile/validation'

// Postgres unique violation code
const PG_UNIQUE_VIOLATION = '23505'

function isPgError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()
  const rows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  const profile = rows[0] ?? null
  return new Response(JSON.stringify({ profile }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { displayName?: unknown; bio?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName : ''
  const rawBio = typeof body.bio === 'string' ? body.bio : ''

  const nameValidation = validateDisplayName(displayName)
  if (!nameValidation.valid) {
    return new Response(JSON.stringify({ error: nameValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const bio = stripHtmlTags(rawBio)
  const bioValidation = validateBio(bio)
  if (!bioValidation.valid) {
    return new Response(JSON.stringify({ error: bioValidation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const db = getDb()
    const rows = await db
      .insert(userProfiles)
      .values({
        userId,
        displayName,
        bio: bio || null,
      })
      .returning({
        id: userProfiles.id,
        displayName: userProfiles.displayName,
        bio: userProfiles.bio,
        avatarUrl: userProfiles.avatarUrl,
        createdAt: userProfiles.createdAt,
      })

    return new Response(JSON.stringify({ profile: rows[0] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (isPgError(err) && err.code === PG_UNIQUE_VIOLATION) {
      return new Response(JSON.stringify({ error: 'This name is already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw err
  }
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { displayName?: unknown; bio?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const db = getDb()

  // Load existing profile
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  if (existing.length === 0) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const profile = existing[0]
  const updates: Partial<typeof profile> & { updatedAt?: Date; displayNameChangedAt?: Date | null } = {
    updatedAt: new Date(),
  }

  if (typeof body.displayName === 'string') {
    const nameValidation = validateDisplayName(body.displayName)
    if (!nameValidation.valid) {
      return new Response(JSON.stringify({ error: nameValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!canChangeDisplayName(profile.displayNameChangedAt)) {
      return new Response(
        JSON.stringify({ error: 'Display name can only be changed once every 30 days' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    updates.displayName = body.displayName
    updates.displayNameChangedAt = new Date()
  }

  if (typeof body.bio === 'string') {
    const bio = stripHtmlTags(body.bio)
    const bioValidation = validateBio(bio)
    if (!bioValidation.valid) {
      return new Response(JSON.stringify({ error: bioValidation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    updates.bio = bio || null
  }

  try {
    const rows = await db
      .update(userProfiles)
      .set(updates)
      .where(eq(userProfiles.userId, userId))
      .returning()

    return new Response(JSON.stringify({ profile: rows[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (isPgError(err) && err.code === PG_UNIQUE_VIOLATION) {
      return new Response(JSON.stringify({ error: 'This name is already taken' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw err
  }
}
