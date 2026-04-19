// Escalation card — shown below the briefing, presents two paths forward.
// Phase 3B: Both "Go Deeper" and "Take Action" are enabled.

interface EscalationCardProps {
  investigationId: string
  onGoDeeper: () => void     // callback when "Go Deeper" is clicked
  onTakeAction: () => void   // callback when "Take Action" is clicked
  lensOpen: boolean          // whether the lens panel is currently showing
  campaignOpen: boolean      // whether the campaign panel is currently showing
}

export function EscalationCard({
  investigationId: _,
  onGoDeeper,
  onTakeAction,
  lensOpen,
  campaignOpen,
}: EscalationCardProps) {
  return (
    <div
      className="rounded-2xl border"
      style={{
        backgroundColor: 'rgba(245, 243, 240, 0.035)',
        borderColor: 'rgba(255, 255, 255, 0.07)',
      }}
    >
      <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Where do you want to go from here?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        {/* Left: Go Deeper (Gadfly / Lens) — enabled */}
        <div className="flex flex-col gap-4 bg-neutral-950 px-6 py-6 sm:rounded-bl-2xl">
          <div className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#C8A84B' }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: '#C8A84B' }}
            >
              I want to understand this deeper
            </span>
          </div>
          <p className="text-sm leading-relaxed text-neutral-400">
            Explore this issue with guided questions, see who the key players are, and understand the deeper context.
          </p>
          <div className="mt-auto">
            <button
              onClick={onGoDeeper}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150"
              style={{
                backgroundColor: lensOpen
                  ? 'rgba(200, 168, 75, 0.20)'
                  : 'rgba(200, 168, 75, 0.12)',
                color: '#C8A84B',
                border: lensOpen
                  ? '1px solid rgba(200, 168, 75, 0.45)'
                  : '1px solid rgba(200, 168, 75, 0.2)',
              }}
              onMouseEnter={(e) => {
                if (!lensOpen) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'rgba(200,168,75,0.18)'
                  el.style.borderColor = 'rgba(200,168,75,0.35)'
                }
              }}
              onMouseLeave={(e) => {
                if (!lensOpen) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'rgba(200,168,75,0.12)'
                  el.style.borderColor = 'rgba(200,168,75,0.2)'
                }
              }}
            >
              {lensOpen ? 'Showing deeper layer' : 'Go Deeper'}
            </button>
          </div>
        </div>

        {/* Right: Take Action (Lever / Campaign) — enabled */}
        <div className="flex flex-col gap-4 bg-neutral-950 px-6 py-6 sm:rounded-br-2xl">
          <div className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: '#C85B5B' }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: '#C85B5B' }}
            >
              I want to do something about this
            </span>
          </div>
          <p className="text-sm leading-relaxed text-neutral-400">
            Generate FOI requests, public comments, campaign materials, and talking points.
          </p>
          <div className="mt-auto">
            <button
              onClick={onTakeAction}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150"
              style={{
                backgroundColor: campaignOpen
                  ? 'rgba(200, 91, 91, 0.20)'
                  : 'rgba(200, 91, 91, 0.12)',
                color: '#C85B5B',
                border: campaignOpen
                  ? '1px solid rgba(200, 91, 91, 0.45)'
                  : '1px solid rgba(200, 91, 91, 0.2)',
              }}
              onMouseEnter={(e) => {
                if (!campaignOpen) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'rgba(200,91,91,0.18)'
                  el.style.borderColor = 'rgba(200,91,91,0.35)'
                }
              }}
              onMouseLeave={(e) => {
                if (!campaignOpen) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'rgba(200,91,91,0.12)'
                  el.style.borderColor = 'rgba(200,91,91,0.2)'
                }
              }}
            >
              {campaignOpen ? 'Showing campaign materials' : 'Take Action'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
