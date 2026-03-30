import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Eye } from 'lucide-react'
import { UploadZone } from '@/components/oracle/upload-zone'
import { DocumentCard } from '@/components/oracle/document-card'

export const metadata = {
  title: 'Oracle — The Republic',
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'rgba(137, 180, 200, 0.25)',
            backgroundColor: 'rgba(137, 180, 200, 0.08)',
          }}
        >
          <Eye size={18} strokeWidth={1.75} style={{ color: '#89B4C8' }} />
        </span>
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Oracle
          </h1>
          <p className="text-xs text-neutral-500">Civic document analysis</p>
        </div>
      </div>

      {/* Upload */}
      <section className="mb-10">
        <h2
          className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500"
        >
          Upload a document
        </h2>
        <UploadZone />
      </section>

      {/* Document list */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Your documents
          {docs.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-600">
              {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            </span>
          )}
        </h2>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/40 px-6 py-10 text-center">
            <p className="text-sm text-neutral-500">
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
