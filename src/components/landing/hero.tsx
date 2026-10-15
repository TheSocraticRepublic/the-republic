import Image from 'next/image'
import { CTAButton } from '@/components/ui/cta-button'

/*
 * M1, the cave (UI plan C4; landing L3, L14).
 *
 * - 88svh, not a full screen: 12% of the forest band shows at the fold, so
 *   the page says there is more below.
 * - Under the tagline, one plain line saying what Open Cave does, and the one
 *   action, "Start an investigation" (the same words as the header and the
 *   closing box).
 * - A radial scrim behind the type block, so the wordmark and tagline never
 *   sit on the lit cave mouth, and an overlay that ends at the cave's own
 *   warm black (`--journey-cave`), the colour movement 2 starts from, so there
 *   is no seam between them.
 */
export function Hero() {
  return (
    <section
      className="relative z-0 flex min-h-[88svh] flex-col items-center justify-center px-6 text-center"
      data-scroll-section="hero"
    >
      {/* Background image with parallax target */}
      <div className="absolute inset-0 z-0 overflow-hidden" data-scroll-hero-image>
        <Image
          src="/landing/cave-ocean.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Overlay: darkens toward the bottom and ends at the cave's warm
            black (L14), matching the opaque top of movement 2. */}
        <div
          data-hero-overlay
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, color-mix(in srgb, var(--journey-cave) 60%, transparent) 82%, var(--journey-cave) 100%)',
          }}
        />
      </div>

      {/* Radial scrim behind the type block (L3, L14). */}
      <div
        aria-hidden="true"
        data-hero-scrim
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 48%, color-mix(in srgb, var(--journey-cave) 55%, transparent), transparent 70%)',
        }}
      />

      <h1
        className="relative z-10 font-extrabold tracking-tight text-white"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(48px, 6vw, 72px)',
          lineHeight: 1.05,
          textShadow: '0 2px 20px rgba(0,0,0,0.3)',
        }}
      >
        Open Cave
      </h1>

      <p
        className="relative z-10 mt-4 italic text-white/80"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(18px, 2.5vw, 22px)',
          lineHeight: 1.4,
        }}
      >
        A Republic for the examined institution.
      </p>

      {/* What it does, in one plain sentence (L3). */}
      <p
        className="relative z-10 mt-6 max-w-[36ch] text-text-secondary"
        style={{ fontFamily: 'var(--font-body)', fontSize: '17px', lineHeight: 1.5 }}
      >
        Bring a government document. Leave with plain language, the right
        questions, and a filing you can send.
      </p>

      {/* The app's one primary recipe (full ink: the near-white fill and
          warm-black label of the dark scope), 44px tall. */}
      <div className="relative z-10 mt-8">
        <CTAButton href="/investigate" variant="primary" size="md" className="min-h-11 justify-center">
          Start an investigation
        </CTAButton>
      </div>

      {/*
        The light shaft — the first hint that light is a line you can follow
        down. Replaces the old scroll-hint bar (D2). Static under
        prefers-reduced-motion (see .light-shaft in globals.css).
      */}
      <div
        className="light-shaft relative z-10 mx-auto mt-[7vh]"
        aria-hidden="true"
      />
    </section>
  )
}
