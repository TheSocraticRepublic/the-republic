import { SectionBackdrop } from './section-backdrop'

export function ActAgency() {
  return (
    <section
      className="relative z-10 bg-surface-0 px-6 py-32"
      data-scroll-section="agency"
      data-scroll-bg="#FAFAF9"
    >
      <SectionBackdrop
        src="/landing/trail-light.jpg"
        opacity={0.75}
        position="center top"
        fade="soft"
      />

      <div className="relative mx-auto max-w-2xl">
        <h2
          className="mb-12 text-center font-bold text-text-primary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 48px)',
            lineHeight: 1.1,
          }}
        >
          You walk the trail again.
        </h2>

        <div
          className="mx-auto space-y-6 text-center text-text-secondary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(16px, 1.8vw, 20px)',
            lineHeight: 1.75,
            maxWidth: '42ch',
          }}
        >
          <p>
            You filed a request the Ministry is legally obligated to answer. You
            submitted a comment during the review period that cited the watershed
            assessment&apos;s own data against its conclusions. You found the
            paragraph in the forest stewardship plan that contradicted the
            licensee&apos;s public assurances.
          </p>
          <p>You didn&apos;t need a lawyer. You needed the right question.</p>
          <p>The trees are the same trees. But you see them differently now.</p>
        </div>

        <p
          className="mt-16 text-center font-bold text-white drop-shadow-md"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(18px, 2.5vw, 24px)',
            lineHeight: 1.3,
          }}
        >
          The unexamined institution is not worth enduring.
        </p>
      </div>
    </section>
  )
}
