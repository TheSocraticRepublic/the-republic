export function DemoVoteRecord() {
  return (
    <div
      className="mx-auto mt-8 max-w-lg overflow-hidden rounded-xl light-scope"
      style={{
        background: '#FAFAF9',
        boxShadow: '0 0 80px rgba(250,250,249,0.18), 0 24px 60px rgba(20,18,14,0.35)',
      }}
      data-scroll-fade
      role="figure"
      aria-label="Illustrative example vote record. Not a real MP or vote."
    >
      {/* The MP, riding, bill and quote are invented. Never put a real
          person's name on a demo record: this card sits on the public landing. */}
      <div className="px-6 py-5">
        <p className="mb-3 text-2xs font-medium uppercase tracking-wider text-text-muted">
          Illustrative example · not a real MP or vote
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-semibold text-text-primary"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Dana Whitlock
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              MP for Cedar Ridge–Upper Fraser
            </p>
          </div>
          <span
            className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-semibold"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent-lever) 12%, transparent)',
              color: 'color-mix(in srgb, var(--accent-lever) 75%, #000)',
            }}
          >
            Nay
          </span>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-text-muted">
            Bill C-49 — Old-Growth Protection and Ecosystem Integrity Act
          </p>
          <p
            className="mt-2 text-sm italic leading-relaxed text-text-secondary"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Called for &quot;sustainable forestry practices&quot; in three public town
            halls, but voted against the bill that would have established
            binding old-growth protections in their riding.
          </p>
        </div>
      </div>
    </div>
  )
}
