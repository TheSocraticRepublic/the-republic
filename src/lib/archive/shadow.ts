/**
 * Shadow detection: identify topics/patterns present in similar investigations
 * that are absent from the target investigation.
 *
 * "Similar" means same jurisdiction AND same concern category.
 * Requires at least 3 similar investigations to avoid noise from small samples.
 *
 * Uses keyword frequency rather than embeddings — simpler, auditable, and
 * sufficient for the institution-document use case where topics are explicit
 * (agency names, policy terms, geographic identifiers) rather than latent.
 */

import { getDb } from '@/lib/db'
import { investigations, shadowAlerts as shadowAlertsTable } from '@/lib/db/schema'
import { eq, and, ne, isNull, sql } from 'drizzle-orm'

export interface ShadowAlert {
  alertType: 'missing_topic' | 'missing_entity' | 'missing_jurisdiction_pattern'
  missingTopic: string
  referenceInvestigationIds: string[]
  confidence: number
}

// Minimum similar investigations required to detect meaningful patterns
const MIN_SIMILAR_INVESTIGATIONS = 3

// Topic must appear in at least this fraction of similar investigations
const PRESENCE_THRESHOLD = 0.5

// Cap alerts to avoid noise
const MAX_ALERTS = 10

// Words too common to be meaningful topics (stoplist)
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
  'that', 'this', 'these', 'those', 'it', 'its', 'they', 'their',
  'there', 'here', 'what', 'which', 'who', 'how', 'when', 'where', 'why',
  'all', 'any', 'each', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'into', 'over', 'after', 'about', 'up', 'out',
  'also', 'if', 'then', 'because', 'while', 'through', 'between',
  'during', 'before', 'under', 'around', 'per', 'within', 'without',
  'including', 'regarding', 'related', 'following', 'based',
])

/**
 * Extract significant terms from a briefing text.
 * Splits on whitespace and punctuation, lowercases, filters stopwords,
 * and keeps words >= 4 characters. Returns a Set for O(1) membership testing.
 */
export function extractTopics(text: string): Set<string> {
  if (!text || !text.trim()) return new Set()

  const words = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && /^[a-z]/.test(w))

  return new Set(words)
}

/**
 * Detect shadow alerts for an investigation by comparing its briefing text
 * against similar investigations in the same jurisdiction + concern category.
 */
export async function detectShadows(
  investigationId: string,
  db: ReturnType<typeof getDb>
): Promise<ShadowAlert[]> {
  // Fetch the target investigation
  const [target] = await db
    .select({
      id: investigations.id,
      jurisdictionId: investigations.jurisdictionId,
      concernCategory: investigations.concernCategory,
      briefingText: investigations.briefingText,
    })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (!target) return []

  // Need both jurisdiction and concern category to find meaningful peers
  if (!target.jurisdictionId || !target.concernCategory) return []

  // Find similar investigations (same jurisdiction + concern category, not self)
  const peers = await db
    .select({
      id: investigations.id,
      briefingText: investigations.briefingText,
    })
    .from(investigations)
    .where(
      and(
        ne(investigations.id, investigationId),
        eq(investigations.jurisdictionId, target.jurisdictionId),
        eq(investigations.concernCategory, target.concernCategory),
        // Only include investigations that have briefing text to analyze
        sql`${investigations.briefingText} IS NOT NULL AND ${investigations.briefingText} != ''`
      )
    )

  if (peers.length < MIN_SIMILAR_INVESTIGATIONS) return []

  // Extract topics from target
  const targetTopics = extractTopics(target.briefingText ?? '')

  // Count how many peers mention each topic
  const topicCounts = new Map<string, string[]>()  // topic -> [investigationIds]

  for (const peer of peers) {
    const peerTopics = extractTopics(peer.briefingText ?? '')
    for (const topic of peerTopics) {
      if (!topicCounts.has(topic)) {
        topicCounts.set(topic, [])
      }
      topicCounts.get(topic)!.push(peer.id)
    }
  }

  // Find topics that appear in >= PRESENCE_THRESHOLD of peers but not in target
  const total = peers.length
  const alerts: ShadowAlert[] = []

  // Sort by confidence (highest first) for consistent output
  const candidates: Array<{ topic: string; peerIds: string[]; confidence: number }> = []

  for (const [topic, peerIds] of topicCounts.entries()) {
    const confidence = peerIds.length / total
    if (confidence >= PRESENCE_THRESHOLD && !targetTopics.has(topic)) {
      candidates.push({ topic, peerIds, confidence })
    }
  }

  // Sort descending by confidence, then alphabetically for determinism
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return a.topic.localeCompare(b.topic)
  })

  // Cap at MAX_ALERTS
  for (const candidate of candidates.slice(0, MAX_ALERTS)) {
    alerts.push({
      alertType: 'missing_topic',
      missingTopic: candidate.topic,
      referenceInvestigationIds: candidate.peerIds,
      confidence: candidate.confidence,
    })
  }

  return alerts
}
