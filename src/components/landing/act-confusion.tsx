import Image from 'next/image'

export function ActConfusion() {
  return (
    <section className="relative z-10 pb-32" data-scroll-section="confusion">
      {/*
        Full-bleed forest band — an establishing shot ABOVE the narrative,
        dark-graded so it never competes with running text (D2). Fades from
        the cave ground at the top seam into the shadow ground at the bottom,
        where the text picks up.
      */}
      <div className="relative h-[44vh] w-full overflow-hidden" aria-hidden="true">
        <Image
          src="/landing/forest-trail.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: 'center 40%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, var(--journey-cave) 0%, rgba(11,10,9,0.4) 16%, rgba(11,10,9,0.5) 66%, var(--journey-shadow) 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 pt-20">
        <h2
          className="mb-9 font-bold text-text-primary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(34px, 4.6vw, 48px)',
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
            maxWidth: '62ch',
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
          <p className="text-text-muted">
            It references the Forest and Range Practices Act, a landscape-level
            biodiversity objective, a visual quality class you&apos;ve never heard
            of, and a watershed assessment that concludes the cumulative
            hydrological impact is &quot;within acceptable thresholds.&quot;
          </p>
          <p>
            You don&apos;t know what questions to ask. You don&apos;t know what&apos;s
            been left out. You have 30 days.
          </p>
        </div>

        {/*
          The shadow-paper: the permit rendered at low luminance — visible,
          not yet readable. This is the shadow on the wall. The same artifact
          returns in movement 4 as full bright paper.
        */}
        <div
          className="shadow-paper mt-11 px-8 py-7"
          data-scroll-fade
          role="img"
          aria-label="A government cutting permit, deliberately dimmed — visible but not yet readable"
        >
          <div className="relative">
            <span
              className="block text-[10px] uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.22em',
                color: 'rgba(250,250,249,0.5)',
              }}
            >
              Ministry of Forests — Cutting Permit CP-2024-0312
            </span>
            <p
              className="mt-3"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'rgba(250,250,249,0.45)',
              }}
            >
              RE: Application for Cutting Permit under Forest Stewardship Plan
              #847 — Timber Supply Area 38, Block CH-4417, Chilliwack Forest
              District
            </p>
            <p
              className="mt-2.5"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'rgba(250,250,249,0.45)',
              }}
            >
              Pursuant to Section 22 of the Forest and Range Practices Act (SBC
              2002, c.69) and the Forest Planning and Practices Regulation
              (B.C. Reg. 14/2004), the licensee applies for a cutting permit
              within the Chilliwack Defined Forest Area…
            </p>
          </div>
        </div>
        <p
          className="mt-3 text-text-muted"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.12em',
          }}
        >
          186 pages. 30 days.
        </p>

        {/*
          The broadening beat — illustrative prose only. No fabricated
          filing, no invented case number, no second shadow-paper. The
          generalization is stated, not staged as another fake document.
        */}
        <div
          className="mt-16 border-t pt-[52px]"
          style={{ borderColor: 'rgba(250,250,249,0.1)' }}
          data-scroll-fade
        >
          <p
            className="text-text-secondary"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(16px, 1.8vw, 20px)',
              lineHeight: 1.75,
              maxWidth: '62ch',
            }}
          >
            Or maybe your fight isn&apos;t a forest at all — a rezoning across
            from the daycare, a transit cut, a school closure. The document is
            different. The shape is the same: a notice you almost missed, a
            comment period that started before you knew to look, a report
            written in the language of the people it&apos;s about, not the
            people it&apos;s for.
          </p>
        </div>

        <p
          className="mt-14 font-extrabold text-text-primary"
          data-scroll-fade
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(24px, 3vw, 31px)',
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          Different trailheads. The same 186 pages.
        </p>
      </div>
    </section>
  )
}
