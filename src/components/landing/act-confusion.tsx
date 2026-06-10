import { DocumentFragment } from './document-fragment'
import { SectionBackdrop } from './section-backdrop'

export function ActConfusion() {
  return (
    <section
      className="relative z-10 bg-surface-0 px-6 pt-82 pb-32"
      data-scroll-section="confusion"
      data-scroll-bg="#F5F4F2"
    >
      <SectionBackdrop
        src="/landing/forest-trail.jpg"
        opacity={0.55}
        position="center 40%"
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
          You notice the markers.
        </h2>

        <div
          className="space-y-6 text-text-secondary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(16px, 1.8vw, 20px)',
            lineHeight: 1.75,
            maxWidth: '58ch',
          }}
        >
          <p>
            You&apos;ve walked this trail every week for three years. Through the
            Douglas fir and the western red cedar, along the creek that feeds
            into the river your kids swim in every August.
          </p>
          <p>
            Last Tuesday, you noticed the orange ribbons. Flagging tape on the
            trees. Then the notice stapled to the trailhead post: a forest
            stewardship plan, a cutting permit application, a 30-day comment
            period. The document is 186 pages.
          </p>
          <p>
            It references the Forest and Range Practices Act, a landscape-level
            biodiversity objective, a visual quality class you&apos;ve never heard of,
            and a watershed assessment that concludes the cumulative hydrological
            impact is &quot;within acceptable thresholds.&quot;
          </p>
          <p>
            You don&apos;t know what questions to ask. You don&apos;t know what&apos;s been
            left out. You have 30 days.
          </p>
        </div>

        <div data-scroll-fade>
          <DocumentFragment />
        </div>
      </div>
    </section>
  )
}
