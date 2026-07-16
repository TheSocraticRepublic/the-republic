import { describe, it, expect, afterEach } from 'vitest'
import { isForumEnabled, forumDisabledResponse } from '@/lib/forum/flag'

describe('isForumEnabled (FORUM-1)', () => {
  afterEach(() => {
    delete process.env.FORUM_ENABLED
  })

  it('is OFF by default (env var unset)', () => {
    delete process.env.FORUM_ENABLED
    expect(isForumEnabled()).toBe(false)
  })

  it('is OFF for an empty string', () => {
    process.env.FORUM_ENABLED = ''
    expect(isForumEnabled()).toBe(false)
  })

  it('is OFF for truthy-looking-but-wrong values (fail closed, not loose coercion)', () => {
    for (const value of ['1', 'yes', 'TRUE', 'True', 'on', 'enabled']) {
      process.env.FORUM_ENABLED = value
      expect(isForumEnabled()).toBe(false)
    }
  })

  it('is ON only for the exact literal string "true"', () => {
    process.env.FORUM_ENABLED = 'true'
    expect(isForumEnabled()).toBe(true)
  })

  it('flips back OFF the moment the var is unset again', () => {
    process.env.FORUM_ENABLED = 'true'
    expect(isForumEnabled()).toBe(true)
    delete process.env.FORUM_ENABLED
    expect(isForumEnabled()).toBe(false)
  })
})

describe('forumDisabledResponse', () => {
  it('returns a 404 with a JSON body — hides existence rather than announcing a lock', async () => {
    const res = forumDisabledResponse()
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    const body = await res.json()
    expect(body).toEqual({ error: 'Not found' })
  })
})
