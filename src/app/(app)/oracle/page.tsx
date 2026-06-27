import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { ArmHeader } from '@/components/layout/arm-header'
import { UploadZone } from '@/components/oracle/upload-zone'
import { DocumentCard } from '@/components/oracle/document-card'

export const metadata = {
  title: 'Oracle',
}

export default async function OraclePage() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      documentType: documents.documentType,
      pageCount: documents.pageCount,
      wordCount: documents.wordCount,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))

  return (
    <div data-arm="oracle" className="mx-auto max-w-2xl px-6 py-10">
      <ArmHeader arm="oracle" title="Oracle" subtitle="Document analysis" />

      {/* Upload */}
      <section className="mb-10">
        <h2
          className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted"
        >
          Upload a document
        </h2>
        <UploadZone />
      </section>

      {/* Document list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Your documents
          {docs.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-text-faint">
              {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            </span>
          )}
        </h2>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-1 px-6 py-10 text-center">
            <p className="text-sm text-text-muted">
              No documents yet. Upload a government document to begin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <DocumentCard
                key={doc.id}
                id={doc.id}
                title={doc.title}
                documentType={doc.documentType}
                pageCount={doc.pageCount}
                wordCount={doc.wordCount}
                status={doc.status}
                createdAt={doc.createdAt}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
