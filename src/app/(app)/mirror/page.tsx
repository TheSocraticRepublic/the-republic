import { ArmHeader } from '@/components/layout/arm-header'
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
    <div data-arm="mirror" className="mx-auto max-w-2xl px-6 py-10">
      <ArmHeader arm="mirror" title="Mirror" subtitle="Cross-jurisdiction comparison" />
      <ComparisonForm initialDocumentId={initialDocumentId} />
    </div>
  )
}
