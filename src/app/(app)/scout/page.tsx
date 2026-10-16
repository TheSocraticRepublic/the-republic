import { ArmHeader } from '@/components/layout/arm-header'
import { DiscoveryForm } from '@/components/scout/discovery-form'

export const metadata = {
  title: 'Scout',
}

/**
 * Plain-instructional, opening on the citizen's action and naming what the
 * results hold (scout-system.ts); "likely" is the prompt's own honesty rule
 * (Jen C2a C2). No "Recently found" list: Scout ingests nothing, so it only
 * ever showed Oracle uploads under a Scout label (Jen C2a C4).
 */
const SCOUT_INTRO =
  'Name a topic or place. Scout lists the public records likely to cover it, where to look for each, and which ones you have to request.'

export default function ScoutPage() {
  return (
    <div data-arm="scout">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader arm="scout" title="Scout" subtitle="Document discovery" intro={SCOUT_INTRO} />
        <DiscoveryForm />
      </div>
    </div>
  )
}
