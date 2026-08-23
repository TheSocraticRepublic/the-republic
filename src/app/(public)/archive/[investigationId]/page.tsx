import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { archiveRecords, investigations, userProfiles, documentVersions, documents, shadowAlerts } from '@/lib/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
import { PermanenceBadge } from '@/components/archive/permanence-badge'
import { ProvenanceChain } from '@/components/archive/provenance-chain'
import { DiffViewer } from '@/components/archive/diff-viewer'
import { ShadowAlert } from '@/components/archive/shadow-alert'

interface PageProps {
  params: Promise<{ investigationId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { investigationId } = await params

  // Mirror the page body's preconditions exactly. The body rejects non-UUID
  // params and requires an `archive_records` row before it renders anything;
  // without the same predicates here this query reads the citizen's concern
  // text for ANY investigation id, archived or not. Next 16 discards metadata
  // when the page throws notFound(), so nothing is emitted today — but the
  // query is still reading data the page has decided the caller may not see,
  // and that is one boundary change away from mattering.
  if (!UUID_RE.test(investigationId)) {
    return { title: 'Archived Investigation' }
  }

  const db = getDb()

  const [row] = await db
    .select({
      concern: investigations.concern,
      snapshotPolicyArea: archiveRecords.policyArea,
    })
    .from(archiveRecords)
    .leftJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
    .where(eq(archiveRecords.investigationId, investigationId))
    .limit(1)

  if (!row) return { title: 'Archived Investigation' }
  const label = row.concern?.slice(0, 80) ?? row.snapshotPolicyArea ?? 'Investigation'
  return { title: `${label} — The Archive` }
}

export const revalidate = 1800

export default async function ArchiveDetailPage({ params }: PageProps) {
  const { investigationId } = await params

  if (!UUID_RE.test(investigationId)) {
    notFound()
  }

  const db = getDb()

  // Fetch archive record + investigation + archivedBy profile in parallel with alerts
  const [archiveRows, alertRows] = await Promise.all([
    db
      .select({
        archiveId: archiveRecords.id,
        archiveStatus: archiveRecords.archiveStatus,
        ipfsCid: archiveRecords.ipfsCid,
        arweaveTxId: archiveRecords.arweaveTxId,
        preservedAt: archiveRecords.preservedAt,
        permanenceAt: archiveRecords.permanenceAt,
        concern: investigations.concern,
        jurisdictionName: investigations.jurisdictionName,
        snapshotJurisdiction: archiveRecords.jurisdictionName,
        snapshotPolicyArea: archiveRecords.policyArea,
        briefingText: investigations.briefingText,
        briefingCompletedAt: investigations.briefingCompletedAt,
        createdAt: investigations.createdAt,
        archivedBy: userProfiles.displayName,
      })
      .from(archiveRecords)
      .leftJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
      .leftJoin(userProfiles, eq(archiveRecords.userId, userProfiles.userId))
      .where(eq(archiveRecords.investigationId, investigationId))
      .limit(1),

    db
      .select({
        id: shadowAlerts.id,
        alertType: shadowAlerts.alertType,
        missingTopic: shadowAlerts.missingTopic,
        confidence: shadowAlerts.confidence,
        referenceCount: shadowAlerts.referenceInvestigationIds,
      })
      .from(shadowAlerts)
      .where(and(
        eq(shadowAlerts.investigationId, investigationId),
        isNull(shadowAlerts.dismissedAt),
      ))
      .orderBy(desc(shadowAlerts.confidence)),
  ])

  if (archiveRows.length === 0) {
    notFound()
  }

  const archive = archiveRows[0]

  // Fetch document versions via documents join
  const versionRows = await db
    .select({
      id: documentVersions.id,
      versionNumber: documentVersions.versionNumber,
      changeType: documentVersions.changeType,
      diffSummary: documentVersions.diffSummary,
      detectedAt: documentVersions.detectedAt,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documentVersions.documentId, documents.id))
    .where(eq(documents.investigationId, investigationId))
    .orderBy(desc(documentVersions.detectedAt))
    .limit(50)

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1
              className="text-lg font-bold tracking-tight text-text-primary leading-snug"
            >
              {archive.concern ?? (archive.snapshotPolicyArea
                ? `Archived investigation — ${archive.snapshotPolicyArea}`
                : 'Archived investigation')}
            </h1>
            {(archive.jurisdictionName ?? archive.snapshotJurisdiction) && (
              <p className="mt-1 text-sm text-text-muted">
                {archive.jurisdictionName ?? archive.snapshotJurisdiction}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 pt-0.5">
            <PermanenceBadge status={archive.archiveStatus} />
          </div>
        </div>

        <p className="mt-2 text-xs text-text-faint">
          Archived by{' '}
          <span className="text-text-muted">{archive.archivedBy ?? 'Account deleted'}</span>
        </p>
      </div>

      {/* Briefing */}
      {archive.briefingText && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Briefing
          </h2>
          <div className="rounded-xl border border-border bg-surface-1 px-5 py-4">
            <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
              {archive.briefingText}
            </p>
          </div>
        </section>
      )}

      {/* Provenance chain */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Provenance
        </h2>
        <ProvenanceChain
          createdAt={archive.createdAt ?? new Date(0)}
          briefingCompletedAt={archive.briefingCompletedAt ?? null}
          preservedAt={archive.preservedAt}
          permanenceAt={archive.permanenceAt}
          ipfsCid={archive.ipfsCid}
          arweaveTxId={archive.arweaveTxId}
        />
      </section>

      {/* Document diff history */}
      {versionRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Document changes detected
          </h2>
          <DiffViewer versions={versionRows} />
        </section>
      )}

      {/* Shadow alerts */}
      {alertRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Shadow alerts
          </h2>
          <div className="space-y-2">
            {alertRows.map((alert) => (
              <ShadowAlert
                key={alert.id}
                alertType={alert.alertType}
                missingTopic={alert.missingTopic}
                confidence={alert.confidence}
                referenceCount={alert.referenceCount?.length ?? 0}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
