import 'server-only'
import { AP_CONTEXT, actorUrl, inboxUrl, outboxUrl, followersUrl } from './context'

export interface ApPerson {
  '@context': unknown
  id: string
  type: 'Person'
  preferredUsername: string
  name?: string
  summary?: string
  icon?: { type: 'Image'; url: string; mediaType: string }
  inbox: string
  outbox: string
  followers: string
  publicKey: {
    id: string
    owner: string
    publicKeyPem: string
  }
}

/**
 * Builds the AP Person JSON-LD document for a Republic user.
 * This is what Mastodon fetches when it looks up a user.
 */
export function buildActorJson(
  profile: {
    apHandle: string
    displayName: string
    bio?: string | null
    avatarUrl?: string | null
  },
  publicKeyPem: string
): ApPerson {
  const id = actorUrl(profile.apHandle)

  const person: ApPerson = {
    '@context': AP_CONTEXT,
    id,
    type: 'Person',
    preferredUsername: profile.apHandle,
    name: profile.displayName,
    inbox: inboxUrl(profile.apHandle),
    outbox: outboxUrl(profile.apHandle),
    followers: followersUrl(profile.apHandle),
    publicKey: {
      id: `${id}#main-key`,
      owner: id,
      publicKeyPem,
    },
  }

  if (profile.bio) {
    person.summary = profile.bio
  }

  if (profile.avatarUrl) {
    person.icon = {
      type: 'Image',
      url: profile.avatarUrl,
      mediaType: 'image/jpeg',
    }
  }

  return person
}
