import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          borderRadius: 6,
          background: '#18181b',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Cave arch */}
        <div
          style={{
            width: 22,
            height: 20,
            borderRadius: '11px 11px 0 0',
            background: 'linear-gradient(to bottom, #a1a1aa, #52525b)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          {/* Light inside the cave */}
          <div
            style={{
              width: 10,
              height: 14,
              borderRadius: '5px 5px 0 0',
              background: 'linear-gradient(to bottom, #fbbf24, #f59e0b)',
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
