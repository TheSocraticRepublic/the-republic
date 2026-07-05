import { ArmHeader } from '@/components/layout/arm-header'
import { ComparisonForm } from '@/components/mirror/comparison-form'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata = {
  title: 'Mirror',
}

interface MirrorPageProps {
  searchParams: Promise<{ documentId?: string }>
}

export default async function MirrorPage({ searchParams }: MirrorPageProps) {
  const { documentId: initialDocumentId } = await searchParams

  return (
    <div data-arm="mirror" className="mx-auto max-w-2xl px-6 py-10">
      <ArmHeader arm="mirror" title="Mirror" subtitle="Cross-jurisdiction comparison" />
      {/* Jen: copy review */}
      <p className="mb-2 text-sm leading-relaxed text-text-secondary">
        Mirror sets a document or policy next to how other jurisdictions
        handle the same issue, so you can see what&apos;s normal and what
        isn&apos;t.
      </p>
      {/* Jen: copy review */}
      <p className="mb-8 text-xs italic text-text-muted">
        Try: compare a rent-increase bylaw against three nearby cities
      </p>
      <ComparisonForm initialDocumentId={initialDocumentId} />
      <EmptyState
        className="mt-10"
        message="Comparisons aren't saved yet — each one is generated fresh. Run it again anytime you need it."
      />
    </div>
  )
}
