import { stripHtmlTags } from '@/lib/profile/validation'

export const THREAD_TITLE_MIN = 5
export const THREAD_TITLE_MAX = 200
export const POST_CONTENT_MIN = 1
export const POST_CONTENT_MAX = 5000
export const MAX_REPLY_DEPTH = 3

export function validateThreadTitle(title: string): { valid: boolean; error?: string } {
  const stripped = stripHtmlTags(title)
  if (stripped.length < THREAD_TITLE_MIN) {
    return { valid: false, error: `Title must be at least ${THREAD_TITLE_MIN} characters` }
  }
  if (stripped.length > THREAD_TITLE_MAX) {
    return { valid: false, error: `Title must be ${THREAD_TITLE_MAX} characters or fewer` }
  }
  return { valid: true }
}

export function validatePostContent(content: string): { valid: boolean; error?: string } {
  const stripped = stripHtmlTags(content)
  if (stripped.length < POST_CONTENT_MIN) {
    return { valid: false, error: 'Post content cannot be empty' }
  }
  if (stripped.length > POST_CONTENT_MAX) {
    return { valid: false, error: `Post content must be ${POST_CONTENT_MAX} characters or fewer` }
  }
  return { valid: true }
}
