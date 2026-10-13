import { ArmHeader } from '@/components/layout/arm-header'
import { DiscoveryForm } from '@/components/scout/discovery-form'
import { ScoutHistory } from '@/components/scout/scout-history'

export const metadata = {
  title: 'Scout',
}

export default function ScoutPage() {
  return (
    <div data-arm="scout">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ArmHeader
          arm="scout"
          title="Scout"
          subtitle="Document discovery"
          intro={
            <>
              Scout searches public records for documents on a topic or place —
              bylaws, budgets, meeting minutes — so you don&apos;t have to know
              which office is holding them.
            </>
          }
        />
        <DiscoveryForm />
        <ScoutHistory />
      </div>
    </div>
  )
}
