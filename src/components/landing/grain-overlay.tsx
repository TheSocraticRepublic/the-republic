'use client'

export function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
      style={{ animation: 'grain-breathe 8s ease-in-out infinite' }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="1"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" opacity="0.03" />
      </svg>
    </div>
  )
}
