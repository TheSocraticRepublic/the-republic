import { DemoFippaCard } from './demo-fippa-card'
import { DemoVoteRecord } from './demo-vote-record'
import { SectionBackdrop } from './section-backdrop'

export function ActAction() {
  return (
    <section className="relative z-10 bg-surface-0 px-6 py-32" data-scroll-section="action">
      <SectionBackdrop
        src="/landing/creek-mist.jpg"
        opacity={0.55}
        position="center"
      />

      <div className="relative mx-auto max-w-2xl">
        <h2
          className="mb-12 font-bold text-text-primary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 40px)',
            lineHeight: 1.15,
          }}
        >
          What does a filing look like?
        </h2>

        <p
          className="mb-12 text-text-secondary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(16px, 1.8vw, 20px)',
            lineHeight: 1.75,
            maxWidth: '58ch',
          }}
        >
          Open Cave does not generate summaries. It generates filings. A
          Freedom of Information request citing the correct statute, addressed to
          the correct office, requesting the specific records your investigation
          identified.
        </p>

        <DemoFippaCard />

        <div className="mt-24">
          <h2
            className="mb-12 font-bold text-text-primary"
            data-scroll-fade
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 40px)',
              lineHeight: 1.15,
            }}
          >
            And what did your MP vote for?
          </h2>

          <p
            className="mb-12 text-text-secondary"
            data-scroll-fade
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              lineHeight: 1.75,
              maxWidth: '58ch',
            }}
          >
            Public statements are easy. Voting records are not. The Vote Tracker
            shows the gap between what your representative says and how they
            vote, then generates a letter you can send to their constituency
            office.
          </p>

          <DemoVoteRecord />
        </div>
      </div>
    </section>
  )
}
