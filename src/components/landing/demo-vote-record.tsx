export function DemoVoteRecord() {
  return (
    <div
      className="mx-auto mt-8 max-w-lg overflow-hidden rounded-xl border border-border-strong bg-surface-1 shadow-sm"
      data-scroll-fade
      aria-label="Example vote record from Open Cave"
    >
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-sm font-semibold text-text-primary"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Mark Strahl
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              MP for Chilliwack-Hope
            </p>
          </div>
          <span className="flex-shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
            Nay
          </span>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-medium text-text-muted">
            Bill C-49 — Old-Growth Protection and Ecosystem Integrity Act
          </p>
          <p
            className="mt-2 text-sm leading-relaxed text-text-secondary"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Called for "sustainable forestry practices" in three public town
            halls, but voted against the bill that would have established
            binding old-growth protections in their riding.
          </p>
        </div>
      </div>
    </div>
  )
}
