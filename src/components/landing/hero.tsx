import Image from 'next/image'
import { ScrollIndicator } from './scroll-indicator'

export function Hero() {
  const hasPhoto = true // flip to false for gradient-only fallback

  return (
    <section
      className="relative z-0 flex min-h-screen flex-col items-center justify-center text-center"
      data-scroll-section="hero"
    >
      {/* Background image with parallax target */}
      <div className="absolute inset-0 z-0 overflow-hidden" data-scroll-hero-image>
        {hasPhoto ? (
          <Image
            src="/landing/hero.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                'linear-gradient(170deg, #2d3b2d 0%, #3d4f3d 30%, #5a6e5a 60%, #8a9b8a 100%)',
            }}
          />
        )}
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
        The Republic
      </h1>

      <p
        className="relative z-10 mt-4 italic text-white/80"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(18px, 2.5vw, 22px)',
          lineHeight: 1.4,
        }}
      >
        The examined institution.
      </p>

      <ScrollIndicator light />
    </section>
  )
}
