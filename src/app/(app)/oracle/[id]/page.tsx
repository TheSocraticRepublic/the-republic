import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { documents, analyses } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Eye, FileText, AlertTriangle, MessageCircleQuestion, GitCompare } from 'lucide-react'
import { OracleAnalysisPanel } from '@/components/oracle/oracle-analysis-panel'
import { CrossArmActions } from '@/components/ui/cross-arm-actions'

export const metadata = {
  title: 'Oracle — The Republic',
}

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDocType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function OracleDocumentPage({ params }: PageProps) {
  const { id } = await params
  const headersList = await headers()
  const userId = headersList.get('x-user-id')!

  const db = getDb()

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)

  if (!doc || doc.userId !== userId) {
    notFound()
  }

  // Fetch most recent analysis if it exists
  const [savedAnalysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.documentId, id))
    .orderBy(desc(analyses.createdAt))
    .limit(1)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Back + header */}
      <div className="mb-8">
        <a
          href="/oracle"
          className="mb-5 inline-flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <span className="text-neutral-600">←</span>
          All documents
        </a>

        <div className="flex items-start gap-3">
          <span
            className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: 'rgba(137, 180, 200, 0.25)',
              backgroundColor: 'rgba(137, 180, 200, 0.08)',
            }}
          >
            <FileText size={18} strokeWidth={1.75} style={{ color: '#89B4C8' }} />
          </span>

          <div className="flex-1 min-w-0">
            <h1
              className="text-xl font-bold leading-snug tracking-tight text-neutral-100"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              {doc.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
              <span>{formatDocType(doc.documentType)}</span>
              {doc.pageCount != null && (
                <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
              )}
              {doc.wordCount != null && (
                <span>{doc.wordCount.toLocaleString()} words</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Extraction quality warning */}
      {doc.extractionQuality != null && doc.extractionQuality < 0.5 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-4 py-3">
          <AlertTriangle size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-yellow-400" />
          <p className="text-xs leading-relaxed text-yellow-200/70">
            This document appears to be a scanned PDF. Text extraction quality may be low,
            which can affect analysis accuracy. No OCR fallback is available in this version.
          </p>
        </div>
      )}

      {/* Document status: failed */}
      {doc.status === 'failed' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-5 py-4 text-sm text-red-300">
          Document processing failed. Please try uploading again.
        </div>
      )}

      {/* Document status: processing */}
      {doc.status === 'processing' && (
        <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.05] px-5 py-4 text-sm text-yellow-200/70">
          Document is still processing. Refresh the page in a moment.
        </div>
      )}

      {/* Analysis panel — handles ready state with streaming + saved analysis */}
      {doc.status === 'ready' && (
        <>
          <OracleAnalysisPanel
            documentId={doc.id}
            savedAnalysis={savedAnalysis?.summary ?? null}
            hasSavedAnalysis={!!savedAnalysis}
          />

          {/* Cross-arm navigation */}
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
              Continue your inquiry
            </p>
            <CrossArmActions
              actions={[
                {
                  label: 'Ask about this',
                  href: `/gadfly?documentId=${doc.id}&title=${encodeURIComponent(doc.title)}`,
                  color: '#C8A84B',
                  icon: MessageCircleQuestion,
                },
                {
                  label: 'Compare with other jurisdictions',
                  href: `/mirror?documentId=${doc.id}`,
                  color: '#5BC88A',
                  icon: GitCompare,
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
