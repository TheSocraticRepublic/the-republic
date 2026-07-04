import { SectionBackdrop } from './section-backdrop'

export function ActAgency() {
  return (
    <section
      className="relative z-10 px-6 py-32"
      data-scroll-section="agency"
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

        {/* The page's closing beat — set apart and large per the spec (the one
            line the whole descent resolves into). */}
        <p
          className="mx-auto mt-24 max-w-2xl text-center font-bold text-text-primary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 4vw, 44px)',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}
        >
          The unexamined institution is not worth enduring.
        </p>
      </div>
    </section>
  )
}
