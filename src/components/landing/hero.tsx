import Image from 'next/image'

export function Hero() {
  return (
    <section
      className="relative z-0 flex min-h-screen flex-col items-center justify-center text-center"
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
        {/* Dark gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.5) 100%)',
          }}
        />
      </div>

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
