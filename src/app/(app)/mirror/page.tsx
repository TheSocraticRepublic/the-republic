import { GitCompare } from 'lucide-react'
import { ComparisonForm } from '@/components/mirror/comparison-form'

export const metadata = {
  title: 'Mirror — The Republic',
}

export default function MirrorPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="mb-10 flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'rgba(91, 200, 138, 0.25)',
            backgroundColor: 'rgba(91, 200, 138, 0.08)',
          }}
        >
          <GitCompare size={18} strokeWidth={1.75} style={{ color: '#5BC88A' }} />
        </span>
        <div>
          <h1
            className="text-xl font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            Mirror
          </h1>
          <p className="text-xs text-neutral-500">Cross-jurisdiction comparison</p>
        </div>
      </div>

      {/* Comparison form + results */}
      <ComparisonForm />
    </div>
  )
}
