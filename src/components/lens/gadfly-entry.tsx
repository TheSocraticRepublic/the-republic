// GadflyEntry — seeded first question that invites the citizen to continue
// their inquiry via the Gadfly slide-over.

const DEFAULT_QUESTION =
  'What assumptions about inevitability does this situation rest on, and who benefits from those assumptions going unchallenged?'

interface GadflyEntryProps {
  investigationId: string
  concern: string
  seededQuestion?: string | null
  onOpenGadfly: () => void
  darkMode?: boolean
}

export function GadflyEntry({
  investigationId: _investigationId,
  concern: _concern,
  seededQuestion,
  onOpenGadfly,
  darkMode = false,
}: GadflyEntryProps) {
  const textColor = darkMode ? '#d4d4d8' : '#44403c'
  const strongColor = darkMode ? '#f4f4f5' : '#1c1917'

  return (
    <div
      className="rounded-xl p-6"
      style={{
        borderLeft: '2px solid var(--accent-gadfly)',
        backgroundColor: darkMode ? 'color-mix(in srgb, var(--accent-gadfly) 6%, transparent)' : 'color-mix(in srgb, var(--accent-gadfly) 4%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-gadfly) 12%, transparent)',
        borderLeftWidth: '2px',
        borderLeftColor: 'var(--accent-gadfly)',
      }}
    >
      {/* Label */}
      <p
        className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'var(--accent-gadfly)' }}
      >
        A question worth sitting with
      </p>

      {/* Seeded question */}
      <p
        className="mb-6 text-sm leading-relaxed"
        style={{ color: textColor }}
      >
        You&apos;ve read the briefing. Here&apos;s a question worth sitting with:{' '}
        <strong style={{ color: strongColor, fontWeight: 600 }}>
          {seededQuestion || DEFAULT_QUESTION}
        </strong>
      </p>

      {/* CTA button */}
      <button
        onClick={onOpenGadfly}
        className="group inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150"
        style={{
          backgroundColor: 'transparent',
          color: 'var(--accent-gadfly)',
          opacity: 0.8,
          border: '1px solid color-mix(in srgb, var(--accent-gadfly) 25%, transparent)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'color-mix(in srgb, var(--accent-gadfly) 10%, transparent)'
          el.style.color = 'var(--accent-gadfly)'
          el.style.opacity = '1'
          el.style.borderColor = 'color-mix(in srgb, var(--accent-gadfly) 40%, transparent)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.backgroundColor = 'transparent'
          el.style.color = 'var(--accent-gadfly)'
          el.style.opacity = '0.8'
          el.style.borderColor = 'color-mix(in srgb, var(--accent-gadfly) 25%, transparent)'
        }}
      >
        Continue this inquiry
        <span style={{ fontSize: '14px', opacity: 0.7 }}>→</span>
      </button>
    </div>
  )
}
