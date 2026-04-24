import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { archiveRecords, investigations, userProfiles, documentVersions, documents, shadowAlerts } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { PermanenceBadge } from '@/components/archive/permanence-badge'
import { ProvenanceChain } from '@/components/archive/provenance-chain'
import { DiffViewer } from '@/components/archive/diff-viewer'
import { ShadowAlert } from '@/components/archive/shadow-alert'

interface PageProps {
  params: Promise<{ investigationId: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { investigationId } = await params
  const db = getDb()

  const [inv] = await db
    .select({ concern: investigations.concern })
    .from(investigations)
    .where(eq(investigations.id, investigationId))
    .limit(1)

  return {
    title: inv ? `${inv.concern.slice(0, 80)} — The Archive` : 'Archived Investigation — The Republic',
  }
}

export default async function ArchiveDetailPage({ params }: PageProps) {
  const { investigationId } = await params
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
        briefingText: investigations.briefingText,
        briefingCompletedAt: investigations.briefingCompletedAt,
        createdAt: investigations.createdAt,
        archivedBy: userProfiles.displayName,
      })
      .from(archiveRecords)
      .innerJoin(investigations, eq(archiveRecords.investigationId, investigations.id))
      .innerJoin(userProfiles, eq(archiveRecords.userId, userProfiles.userId))
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
              className="text-lg font-bold tracking-tight text-neutral-100 leading-snug"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              {archive.concern}
            </h1>
            {archive.jurisdictionName && (
              <p className="mt-1 text-sm text-neutral-500">{archive.jurisdictionName}</p>
            )}
          </div>
          <div className="flex-shrink-0 pt-0.5">
            <PermanenceBadge status={archive.archiveStatus} />
          </div>
        </div>

        <p className="mt-2 text-xs text-neutral-600">
          Archived by{' '}
          <span className="text-neutral-500">{archive.archivedBy}</span>
        </p>
      </div>

      {/* Briefing */}
      {archive.briefingText && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Briefing
          </h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
              {archive.briefingText}
            </p>
          </div>
        </section>
      )}

      {/* Provenance chain */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Provenance
        </h2>
        <ProvenanceChain
          createdAt={archive.createdAt}
          briefingCompletedAt={archive.briefingCompletedAt}
          preservedAt={archive.preservedAt}
          permanenceAt={archive.permanenceAt}
          ipfsCid={archive.ipfsCid}
          arweaveTxId={archive.arweaveTxId}
        />
      </section>

      {/* Document diff history */}
      {versionRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Document changes detected
          </h2>
          <DiffViewer versions={versionRows} />
        </section>
      )}

      {/* Shadow alerts */}
      {alertRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
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
