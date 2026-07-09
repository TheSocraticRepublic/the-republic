import Link from 'next/link'
import { headers } from 'next/headers'
import { getDb } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { EmptyState } from '@/components/ui/empty-state'
import { formatRelativeTime } from '@/lib/format-relative-time'

function formatDocType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Recently ingested documents, shown below the Scout discovery form.
 *
 * Scoped to standalone finds only (investigationId IS NULL). Once a document
 * is folded into an investigation it already has a home there — showing it
 * again here would duplicate the same record under two different "recent"
 * lists with no single owner.
 */
export async function ScoutHistory() {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')

  let recentDocuments: Array<{
    id: string
    title: string
    documentType: string
    createdAt: Date
  }> = []

  if (userId) {
    const db = getDb()
    recentDocuments = await db
      .select({
        id: documents.id,
        title: documents.title,
        documentType: documents.documentType,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.investigationId)))
      .orderBy(desc(documents.createdAt))
      .limit(5)
  }

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
        Recently found
      </h2>
      {recentDocuments.length === 0 ? (
        <EmptyState message="Documents you find with Scout will appear here." />
      ) : (
        <div className="space-y-3">
          {recentDocuments.map((doc) => (
            <Link
              key={doc.id}
              href={`/oracle/${doc.id}`}
              className="card-lift block rounded-xl border border-border bg-surface-1 px-4 py-3 transition-colors duration-150 hover:border-border-strong"
            >
              <p className="line-clamp-2 text-sm text-text-secondary">{doc.title}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-text-muted">
                  {formatDocType(doc.documentType)}
                </span>
                <span className="ml-auto text-xs text-text-muted">
                  {formatRelativeTime(doc.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
