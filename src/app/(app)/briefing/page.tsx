import { BriefingForm } from '@/components/briefing/briefing-form'

export const metadata = {
  title: 'Briefing — The Republic',
}

export default function BriefingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1
          className="mb-3 text-3xl font-bold tracking-tight text-neutral-100"
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
        >
          What concerns you?
        </h1>
        <p className="text-base leading-relaxed text-neutral-400">
          Describe a civic issue and we will investigate it for you — documents, analysis, actions, and context in one briefing.
        </p>
      </div>

      <BriefingForm />
    </div>
  )
}
