import { ArmHeader } from '@/components/layout/arm-header'
import { DiscoveryForm } from '@/components/scout/discovery-form'

export const metadata = {
  title: 'Scout',
}

export default function ScoutPage() {
  return (
    <div data-arm="scout" className="mx-auto max-w-2xl px-6 py-10">
      <ArmHeader arm="scout" title="Scout" subtitle="Document discovery" />
      <DiscoveryForm />
    </div>
  )
}
