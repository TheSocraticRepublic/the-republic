// GadflyEntry — seeded first question that invites the citizen to continue
// their inquiry via the Gadfly slide-over.

interface GadflyEntryProps {
  investigationId: string
  concern: string
  onOpenGadfly: () => void
}

export function GadflyEntry({
  investigationId: _investigationId,
  concern: _concern,
  onOpenGadfly,
}: GadflyEntryProps) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        borderLeft: '2px solid #C8A84B',
        backgroundColor: 'rgba(200,168,75,0.04)',
        border: '1px solid rgba(200,168,75,0.12)',
        borderLeftWidth: '2px',
        borderLeftColor: '#C8A84B',
      }}
    >
      {/* Label */}
      <p
        className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: '#C8A84B' }}
      >
        A question worth sitting with
      </p>

      {/* Seeded question */}
      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: '#d4d4d4' }}
      >
        You've read the briefing. Here's a question worth sitting with:{' '}
        <strong style={{ color: '#f5f5f5', fontWeight: 600 }}>
          What assumptions about inevitability does this situation rest on, and who benefits
          from those assumptions going unchallenged?
        </strong>
      </p>

      {/* CTA button */}
      <button
        onClick={onOpenGadfly}
        className="group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150"
        style={{
          backgroundColor: 'transparent',
          color: '#a38339',
          border: '1px solid rgba(200,168,75,0.25)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'rgba(200,168,75,0.10)'
          el.style.color = '#C8A84B'
          el.style.borderColor = 'rgba(200,168,75,0.4)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'transparent'
          el.style.color = '#a38339'
          el.style.borderColor = 'rgba(200,168,75,0.25)'
        }}
      >
        Continue this inquiry
        <span style={{ fontSize: '14px', opacity: 0.7 }}>→</span>
      </button>
    </div>
  )
}
