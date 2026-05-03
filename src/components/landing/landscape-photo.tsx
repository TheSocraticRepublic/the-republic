import Image from 'next/image'

interface LandscapePhotoProps {
  src: string
  alt: string
  className?: string
  priority?: boolean
  gradient?: 'bottom' | 'top' | 'none'
  rounded?: boolean
  shadow?: boolean
  aspectRatio?: string
}

export function LandscapePhoto({
  src,
  alt,
  className = '',
  priority = false,
  gradient = 'none',
  rounded = true,
  shadow = true,
  aspectRatio = '21/9',
}: LandscapePhotoProps) {
  const gradients: Record<string, string> = {
    bottom:
      'linear-gradient(to bottom, transparent 50%, var(--surface-0) 100%)',
    top: 'linear-gradient(to top, transparent 50%, var(--surface-0) 100%)',
    none: 'none',
  }

  return (
    <div
      className={`relative overflow-hidden ${rounded ? 'rounded-xl' : ''} ${shadow ? 'shadow-md' : ''} ${className}`}
      style={{ aspectRatio }}
      data-scroll-parallax-photo
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 80vw"
        className="object-cover"
        priority={priority}
        unoptimized
      />
      {gradient !== 'none' && (
        <div
          className="absolute inset-0"
          style={{ background: gradients[gradient] }}
        />
      )}
    </div>
  )
}

export function LandscapePhotoPlaceholder({
  className = '',
  rounded = true,
  shadow = true,
  aspectRatio = '21/9',
  mood = 'forest',
}: {
  className?: string
  rounded?: boolean
  shadow?: boolean
  aspectRatio?: string
  mood?: 'forest' | 'mist' | 'warm'
}) {
  const gradients: Record<string, string> = {
    forest:
      'linear-gradient(135deg, #2d3b2d 0%, #4a5c4a 40%, #6b7d6b 70%, #8a9b8a 100%)',
    mist: 'linear-gradient(180deg, #c8ccc8 0%, #9ba39b 40%, #7d877d 100%)',
    warm: 'linear-gradient(135deg, #5c6b4a 0%, #8a9b6b 40%, #b8c4a0 70%, #d4dcc4 100%)',
  }

  return (
    <div
      className={`relative overflow-hidden ${rounded ? 'rounded-xl' : ''} ${shadow ? 'shadow-md' : ''} ${className}`}
      style={{ aspectRatio, background: gradients[mood] }}
      data-scroll-parallax-photo
    />
  )
}
