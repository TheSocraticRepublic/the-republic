import { getDb } from '@/lib/db'
import {
  investigations,
  documents,
  analyses,
  forumThreads,
  forumPosts,
  peerReviews,
  jurisdictions,
} from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { readFileSync } from 'fs'
import { join } from 'path'

// Maximum raw text characters to include per document in the bundle
const RAW_TEXT_LIMIT = 50_000

export interface ArchiveBundleDocument {
  id: string
  title: string
  sourceUrl: string | null
  documentType: string
  rawText: string | null
  pageCount: number | null
  wordCount: number | null
}

export interface ArchiveBundleAnalysis {
  id: string
  summary: string | null
  keyFindings: unknown
  powerMap: unknown
  hiddenAssumptions: unknown
  questionsToAsk: unknown
}

export interface ArchiveBundlePost {
  id: string
  content: string
  status: string
  createdAt: string
}

export interface ArchiveBundleThread {
  id: string
  title: string
  postCount: number
  status: string
  posts: ArchiveBundlePost[]
}

export interface ArchiveBundlePeerReview {
  id: string
  factualAccuracy: number
  sourceQuality: number
  missingContext: number
  strategicEffectiveness: number
  jurisdictionalAccuracy: number
  summary: string | null
}

export interface ArchiveBundleInvestigation {
  id: string
  concern: string
  jurisdictionId: string | null
  policyArea: string | null
  briefingText: string | null
  status: string
  createdAt: string
}

export interface ArchiveBundleProvenance {
  archiverId: string
  jurisdiction: string | null
  concernCategory: string | null
}

export interface ArchiveBundle {
  version: '1.0'
  preservedAt: string
  republicVersion: string
  investigation: ArchiveBundleInvestigation
  documents: ArchiveBundleDocument[]
  analyses: ArchiveBundleAnalysis[]
  forumThreads: ArchiveBundleThread[]
  peerReviews: ArchiveBundlePeerReview[]
  provenance: ArchiveBundleProvenance
}

// Module-level constant — read package.json once at import time, not on every call.
const REPUBLIC_VERSION: string = (() => {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
})()

export async function buildArchiveBundle(
  investigationId: string,
  db: ReturnType<typeof getDb>,
  // preservedAt must be captured BEFORE the IPFS pin so the bundle timestamp
  // and the DB record timestamp are identical. Callers should pass `new Date()`
  // captured prior to calling pinInvestigation().
  preservedAt: Date = new Date()
): Promise<ArchiveBundle> {
  // Fetch the investigation
  const [inv] = await db
    .select({
      id: investigations.id,
      concern: investigations.concern,
      jurisdictionId: investigations.jurisdictionId,
      jurisdictionName: investigations.jurisdictionName,
      policyArea: investigations.policyArea,
      briefingText: investigations.briefingText,
      concernCategory: investigations.concernCategory,
      status: investigations.status,
      createdAt: investigations.createdAt,
    })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  if (!inv) {
    throw new Error(`Investigation not found: ${investigationId}`)
  }

  // Resolve jurisdiction name if not already stored
  let jurisdictionName: string | null = inv.jurisdictionName ?? null
  if (!jurisdictionName && inv.jurisdictionId) {
    const [jur] = await db
      .select({ name: jurisdictions.name })
      .from(jurisdictions)
      .where(eq(jurisdictions.id, inv.jurisdictionId))
      .limit(1)
    jurisdictionName = jur?.name ?? null
  }

  // Fetch documents linked to this investigation
  const rawDocs = await db
    .select({
      id: documents.id,
      title: documents.title,
      sourceUrl: documents.sourceUrl,
      documentType: documents.documentType,
      rawText: documents.rawText,
      pageCount: documents.pageCount,
      wordCount: documents.wordCount,
    })
    .from(documents)
    .where(eq(documents.investigationId, investigationId))

  const bundleDocs: ArchiveBundleDocument[] = rawDocs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    sourceUrl: doc.sourceUrl,
    documentType: doc.documentType,
    rawText:
      doc.rawText && doc.rawText.length > RAW_TEXT_LIMIT
        ? doc.rawText.slice(0, RAW_TEXT_LIMIT)
        : (doc.rawText ?? null),
    pageCount: doc.pageCount,
    wordCount: doc.wordCount,
  }))

  // Fetch analyses — joined through documents for this investigation
  const docIds = rawDocs.map((d) => d.id)
  let bundleAnalyses: ArchiveBundleAnalysis[] = []

  if (docIds.length > 0) {
    // Single query using inArray — avoids N+1 per-document fetches
    const analysisRows = await db
      .select({
        id: analyses.id,
        summary: analyses.summary,
        keyFindings: analyses.keyFindings,
        powerMap: analyses.powerMap,
        hiddenAssumptions: analyses.hiddenAssumptions,
        questionsToAsk: analyses.questionsToAsk,
      })
      .from(analyses)
      .where(inArray(analyses.documentId, docIds))

    bundleAnalyses = analysisRows.map((a) => ({
      id: a.id,
      summary: a.summary,
      keyFindings: a.keyFindings,
      powerMap: a.powerMap,
      hiddenAssumptions: a.hiddenAssumptions,
      questionsToAsk: a.questionsToAsk,
    }))
  }

  // Fetch forum threads linked to this investigation, with visible posts
  const rawThreads = await db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      postCount: forumThreads.postCount,
      status: forumThreads.status,
    })
    .from(forumThreads)
    .where(eq(forumThreads.investigationId, investigationId))

  const bundleThreads: ArchiveBundleThread[] = await Promise.all(
    rawThreads.map(async (thread) => {
      const posts = await db
        .select({
          id: forumPosts.id,
          content: forumPosts.content,
          status: forumPosts.status,
          createdAt: forumPosts.createdAt,
        })
        .from(forumPosts)
        .where(
          and(
            eq(forumPosts.threadId, thread.id),
            eq(forumPosts.status, 'visible')
          )
        )

      return {
        id: thread.id,
        title: thread.title,
        // Use actual visible post count rather than the cached counter, which
        // may include hidden/removed posts not present in the bundle.
        postCount: posts.length,
        status: thread.status,
        posts: posts.map((p) => ({
          id: p.id,
          content: p.content,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        })),
      }
    })
  )

  // Fetch peer reviews — reviewer IDs stripped for privacy
  const rawReviews = await db
    .select({
      id: peerReviews.id,
      factualAccuracy: peerReviews.factualAccuracy,
      sourceQuality: peerReviews.sourceQuality,
      missingContext: peerReviews.missingContext,
      strategicEffectiveness: peerReviews.strategicEffectiveness,
      jurisdictionalAccuracy: peerReviews.jurisdictionalAccuracy,
      summary: peerReviews.summary,
    })
    .from(peerReviews)
    .where(eq(peerReviews.investigationId, investigationId))

  const bundleReviews: ArchiveBundlePeerReview[] = rawReviews.map((r) => ({
    id: r.id,
    factualAccuracy: r.factualAccuracy,
    sourceQuality: r.sourceQuality,
    missingContext: r.missingContext,
    strategicEffectiveness: r.strategicEffectiveness,
    jurisdictionalAccuracy: r.jurisdictionalAccuracy,
    summary: r.summary,
  }))

  return {
    version: '1.0',
    preservedAt: preservedAt.toISOString(),
    republicVersion: REPUBLIC_VERSION,
    investigation: {
      id: inv.id,
      concern: inv.concern,
      jurisdictionId: inv.jurisdictionId ?? null,
      policyArea: inv.policyArea ?? null,
      briefingText: inv.briefingText ?? null,
      status: inv.status,
      createdAt: inv.createdAt.toISOString(),
    },
    documents: bundleDocs,
    analyses: bundleAnalyses,
    forumThreads: bundleThreads,
    peerReviews: bundleReviews,
    provenance: {
      archiverId: '', // caller sets this before hashing
      jurisdiction: jurisdictionName,
      concernCategory: inv.concernCategory ?? null,
    },
  }
}
