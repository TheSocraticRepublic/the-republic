import { Compass } from 'lucide-react'
import { DiscoveryForm } from '@/components/scout/discovery-form'

export const metadata = {
  title: 'Scout — The Republic',
}

export default function ScoutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'rgba(176, 136, 200, 0.25)',
            backgroundColor: 'rgba(176, 136, 200, 0.08)',
          }}
        >
          <Compass size={18} strokeWidth={1.75} style={{ color: '#B088C8' }} />
        </span>
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Scout
          </h1>
          <p className="text-xs text-neutral-500">Document discovery</p>
        </div>
      </div>

      {/* Discovery form + results */}
      <DiscoveryForm />
    </div>
  )
}
