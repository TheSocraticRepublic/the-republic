import Image from 'next/image'
import { ConcernForm } from '@/components/investigation/concern-form'

export const metadata = {
  title: 'New Investigation — The Republic',
}

export default function InvestigatePage() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Faint landscape backdrop */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <Image
          src="/landing/hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ opacity: 0.06, objectPosition: 'center 60%' }}
          unoptimized
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, var(--surface-0) 0%, transparent 30%, transparent 70%, var(--surface-0) 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1
            className="mb-3 text-3xl font-bold tracking-tight text-text-primary"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What concerns you?
          </h1>
          <p className="text-base leading-relaxed text-text-secondary">
            Describe a civic issue and we will investigate it for you —
            documents, analysis, actions, and context in one briefing.
          </p>
        </div>

        <ConcernForm />

        {/* Contextual anchor */}
        <p
          className="mt-16 text-center text-sm italic text-text-faint"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Every investigation begins with a question you didn't know how to ask.
        </p>
      </div>
    </div>
  )
}
