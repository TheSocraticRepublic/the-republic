import { TopoPattern } from './topo-pattern'

const arms = [
  {
    name: 'Scout',
    question: 'What if you knew which documents to look for?',
    body: 'The Scout identifies the documents that govern your issue — the cutting permit, the forest stewardship plan, the watershed assessment, the comparable harvest plans from adjacent tenure holders — before you have to read a word. You start with a concern, not a document number.',
    accent: '#9333EA',
    texture: 'topo' as const,
  },
  {
    name: 'Oracle',
    question: 'What if 186 pages could speak plainly?',
    body: 'The Oracle reads the full forest stewardship plan and surfaces what matters: which streams are classified as fish-bearing, what the cumulative cut-block percentage means for the watershed, and why the visual quality assessment doesn\'t mention the trail you walk every week. It is a lens, not an advocate. It shows you where to look.',
    accent: '#0891B2',
    texture: 'clean' as const,
  },
  {
    name: 'Gadfly',
    question: 'What if you knew what you don\'t know?',
    body: 'The Gadfly never gives you answers. It asks the questions that the document\'s authors hoped no one would think to ask. Each question you pursue builds your capacity to read the next document without the tool.',
    pullQuote: 'That is the point.',
    accent: '#B45309',
    texture: 'glow' as const,
  },
  {
    name: 'Lever',
    question: 'What can you actually do with what you know?',
    body: 'The Lever generates a formal Freedom of Information request to the Ministry of Forests citing the Forest and Range Practices Act. Not an outline. Not a suggestion. A document you can file today. The Vote Tracker shows how your MP voted on old-growth protection. The letter it generates goes to a real person at a real address.',
    accent: '#DC2626',
    texture: 'ruled' as const,
  },
]

export function ActUnderstanding() {
  return (
    <section className="relative z-10 bg-surface-0 px-6 py-24" data-scroll-section="understanding">
      <div className="mx-auto max-w-2xl space-y-32">
        {arms.map((arm) => (
          <div
            key={arm.name}
            className="relative overflow-hidden rounded-2xl px-8 py-12 transition-colors duration-500"
            style={{
              backgroundColor:
                arm.texture === 'clean'
                  ? 'var(--surface-1)'
                  : `${arm.accent}08`,
              borderLeft: `2px solid ${arm.accent}30`,
              boxShadow:
                arm.texture === 'clean' ? 'var(--shadow-sm)' : 'none',
            }}
            data-scroll-fade
            data-scroll-color={arm.name.toLowerCase()}
          >
            {/* Texture layers */}
            {arm.texture === 'topo' && <TopoPattern color={arm.accent} />}
            {arm.texture === 'glow' && (
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                  background: `radial-gradient(ellipse at center, ${arm.accent}08 0%, transparent 70%)`,
                }}
              />
            )}
            {arm.texture === 'ruled' && (
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{
                  background:
                    'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(28,25,23,0.03) 27px, rgba(28,25,23,0.03) 28px)',
                }}
              />
            )}

            <div className="relative">
              <span
                className="mb-4 block text-xs font-semibold uppercase tracking-widest"
                style={{
                  color: arm.accent,
                  fontFamily: 'var(--font-display)',
                }}
              >
                {arm.name}
              </span>

              <h2
                className="mb-8 font-bold text-text-primary"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(28px, 4vw, 40px)',
                  lineHeight: 1.15,
                }}
              >
                {arm.question}
              </h2>

              <p
                className="text-text-secondary"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(16px, 1.8vw, 20px)',
                  lineHeight: 1.75,
                  maxWidth: '58ch',
                }}
              >
                {arm.body}
              </p>

              {arm.pullQuote && (
                <p
                  className="mt-10 text-center italic"
                  data-scroll-fade
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'clamp(22px, 3vw, 32px)',
                    lineHeight: 1.4,
                    color: arm.accent,
                  }}
                >
                  {arm.pullQuote}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
