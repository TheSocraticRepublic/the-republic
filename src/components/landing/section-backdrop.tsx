import Image from 'next/image'

export function SectionBackdrop({
  src,
  alt = '',
  opacity = 0.35,
  position = 'center',
  fade = 'normal',
}: {
  src: string
  alt?: string
  opacity?: number
  position?: string
  fade?: 'normal' | 'soft' | 'none'
}) {
  const fadeGradients: Record<string, string> = {
    normal:
      'linear-gradient(to bottom, var(--surface-0) 0%, transparent 25%, transparent 75%, var(--surface-0) 100%)',
    soft:
      'linear-gradient(to bottom, var(--surface-0) 0%, transparent 12%, transparent 88%, var(--surface-0) 100%)',
    none: 'none',
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: position, opacity }}
      />
      {fade !== 'none' && (
        <div
          className="absolute inset-0"
          style={{ background: fadeGradients[fade] }}
        />
      )}
    </div>
  )
}
