import { ArmHeader } from '@/components/layout/arm-header'
import { DiscoveryForm } from '@/components/scout/discovery-form'
import { ScoutHistory } from '@/components/scout/scout-history'

export const metadata = {
  title: 'Scout',
}

export default function ScoutPage() {
  return (
    <div data-arm="scout" className="mx-auto max-w-2xl px-6 py-10">
      <ArmHeader arm="scout" title="Scout" subtitle="Document discovery" />
      {/* Jen: copy review */}
      <p className="mb-2 text-sm leading-relaxed text-text-secondary">
        Scout searches public records for documents on a topic or place —
        bylaws, budgets, meeting minutes — so you don&apos;t have to know
        which office is holding them.
      </p>
      {/* Jen: copy review */}
      <p className="mb-8 text-xs italic text-text-muted">
        Try: short-term rental bylaw changes in your city
      </p>
      <DiscoveryForm />
      <ScoutHistory />
    </div>
  )
}
