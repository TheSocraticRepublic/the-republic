// Escalation card — shown below the briefing, presents two paths forward.
// Both actions are disabled in Phase 1D; Phases 2 and 3 will enable them.

interface EscalationCardProps {
  investigationId: string
}

export function EscalationCard({ investigationId: _ }: EscalationCardProps) {
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
        {/* Left: Go Deeper (Gadfly / Lens) */}
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
          <div className="mt-auto flex flex-col items-start gap-2">
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold cursor-not-allowed opacity-30 transition-opacity"
              style={{
                backgroundColor: 'rgba(200, 168, 75, 0.12)',
                color: '#C8A84B',
                border: '1px solid rgba(200, 168, 75, 0.2)',
              }}
            >
              Go Deeper
            </button>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(200, 168, 75, 0.10)', color: '#C8A84B' }}>
              Coming soon
            </span>
          </div>
        </div>

        {/* Right: Take Action (Lever / Campaign) */}
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
          <div className="mt-auto flex flex-col items-start gap-2">
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold cursor-not-allowed opacity-30 transition-opacity"
              style={{
                backgroundColor: 'rgba(200, 91, 91, 0.12)',
                color: '#C85B5B',
                border: '1px solid rgba(200, 91, 91, 0.2)',
              }}
            >
              Take Action
            </button>
            <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'rgba(200, 91, 91, 0.10)', color: '#C85B5B' }}>
              Coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
