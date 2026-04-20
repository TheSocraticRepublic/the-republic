const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9_-]+$/
const DISPLAY_NAME_MIN = 3
const DISPLAY_NAME_MAX = 50
const BIO_MAX = 500
const COOLDOWN_DAYS = 30

export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

export function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length === 0) {
    return { valid: false, error: 'Display name is required' }
  }
  if (name.length < DISPLAY_NAME_MIN) {
    return { valid: false, error: `Display name must be at least ${DISPLAY_NAME_MIN} characters` }
  }
  if (name.length > DISPLAY_NAME_MAX) {
    return { valid: false, error: `Display name must be ${DISPLAY_NAME_MAX} characters or fewer` }
  }
  if (!DISPLAY_NAME_REGEX.test(name)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, underscores, and hyphens' }
  }
  return { valid: true }
}

export function validateBio(bio: string): { valid: boolean; error?: string } {
  if (bio.length > BIO_MAX) {
    return { valid: false, error: `Bio must be ${BIO_MAX} characters or fewer` }
  }
  return { valid: true }
}

export function canChangeDisplayName(lastChangedAt: Date | null): boolean {
  if (lastChangedAt === null) return true
  const now = Date.now()
  const msPerDay = 1000 * 60 * 60 * 24
  const daysSince = (now - lastChangedAt.getTime()) / msPerDay
  return daysSince >= COOLDOWN_DAYS
}
