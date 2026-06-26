import { GitCompare } from 'lucide-react'
import { ComparisonForm } from '@/components/mirror/comparison-form'

export const metadata = {
  title: 'Mirror',
}

interface MirrorPageProps {
  searchParams: Promise<{ documentId?: string }>
}

export default async function MirrorPage({ searchParams }: MirrorPageProps) {
  const { documentId: initialDocumentId } = await searchParams

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'color-mix(in srgb, var(--accent-mirror) 25%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--accent-mirror) 8%, transparent)',
          }}
        >
          <GitCompare size={18} strokeWidth={1.75} style={{ color: 'var(--accent-mirror)' }} />
        </span>
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-text-primary"
          >
            Mirror
          </h1>
          <p className="text-xs text-text-muted">Cross-jurisdiction comparison</p>
        </div>
      </div>

      {/* Comparison form + results */}
      <ComparisonForm initialDocumentId={initialDocumentId} />
    </div>
  )
}
