import { ArmHeader } from '@/components/layout/arm-header'
import { ComparisonForm } from '@/components/mirror/comparison-form'

export const metadata = {
  title: 'Mirror',
}

/**
 * Convivial-plain (CLAUDE.md copy register): warm, human, no jargon ("places",
 * not "jurisdictions"). No example here: the question field's placeholder
 * carries the one example, a matter a municipality can actually decide (Jen C2a C3).
 */
const MIRROR_INTRO =
  "Mirror sets a document or policy next to how other places handle the same issue, so you can see what's normal and what isn't."

interface MirrorPageProps {
  searchParams: Promise<{ documentId?: string }>
}

export default async function MirrorPage({ searchParams }: MirrorPageProps) {
  const { documentId: initialDocumentId } = await searchParams

  return (
    <div data-arm="mirror">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader
          arm="mirror"
          title="Mirror"
          subtitle="Cross-jurisdiction comparison"
          intro={MIRROR_INTRO}
        />
        <ComparisonForm initialDocumentId={initialDocumentId} />
      </div>
    </div>
  )
}
