import type React from 'react'

// Five arms as stations on a vertical thread (D2 batch 2) — the app's own
// `.investigation-thread` idiom surfacing on the landing page. Accent colors
// are now `var(--accent-*)` tokens: `<html>` carries `.dark` always, and this
// movement never opts into `.light-scope`, so these resolve to the dark
// variant automatically — no `-d` suffix needed. See globals.css `.arm-thread`
// / `.arm-station`.
const arms = [
  {
    name: 'Scout',
    archetype: 'THE PERIPATETIC',
    question: 'What if you knew which documents to look for?',
    body: 'The Scout identifies the documents that govern your issue: the cutting permit, the forest stewardship plan, the watershed assessment, the comparable harvest plans from adjacent tenure holders. All before you have to read a word. You start with a concern, not a document number.',
    accent: 'var(--accent-scout)',
  },
  {
    name: 'Oracle',
    archetype: 'THE PYTHIA',
    question: 'What if 186 pages could speak plainly?',
    body: 'The Oracle reads the full forest stewardship plan and shows you what matters: which streams are classified as fish-bearing, what the cumulative cut-block percentage means for the watershed, and why the visual quality assessment doesn\'t mention the trail you walk every week. It is a lens, not an advocate. It shows you where to look.',
    accent: 'var(--accent-oracle)',
  },
  {
    name: 'Gadfly',
    archetype: 'SOCRATES',
    question: 'What if you knew what you don\'t know?',
    body: 'The Gadfly never gives you answers. It asks the questions that the document\'s authors hoped no one would think to ask. Each question you pursue builds your capacity to read the next document without the tool.',
    pullQuote: 'That is the point.',
    accent: 'var(--accent-gadfly)',
  },
  {
    name: 'Lever',
    archetype: 'THE HERALD',
    question: 'What can you actually do with what you know?',
    body: 'The Lever generates a formal Freedom of Information request citing the correct statute. Not an outline. Not a suggestion. A document you can file today — addressed to a real person at a real address.',
    accent: 'var(--accent-lever)',
  },
  {
    name: 'Mirror',
    archetype: 'THE TRAVELLER',
    question: 'What if someone already solved this?',
    body: 'The Traveller returns with how other jurisdictions handled the same fight — real places, real outcomes, cited.',
    accent: 'var(--accent-mirror)',
  },
]

export function ActUnderstanding() {
  return (
    <section className="relative z-10 px-6 py-24" data-scroll-section="understanding">
      <div className="mx-auto max-w-3xl">
        <div className="arm-thread">
          {arms.map((arm) => (
            <div
              key={arm.name}
              className="arm-station pt-[34px] pb-11"
              style={{ '--acc': arm.accent } as React.CSSProperties}
              data-scroll-fade
            >
              <div className="flex items-center gap-3">
                {/* D4 mark slot — reserved space for the arm's mark, not built here */}
                <span className="inline-block h-5 w-5 shrink-0" aria-hidden="true" />
                <span
                  className="font-semibold"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    color: arm.accent,
                  }}
                >
                  {arm.name}
                </span>
                <span
                  className="text-text-muted"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                  }}
                >
                  {arm.archetype}
                </span>
              </div>

              <h2
                className="mt-2.5 mb-3 font-bold text-text-primary"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(26px, 3.2vw, 32px)',
                  lineHeight: 1.2,
                }}
              >
                {arm.question}
              </h2>

              <p
                className="text-text-secondary"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '16.5px',
                  lineHeight: 1.7,
                  maxWidth: '58ch',
                }}
              >
                {arm.body}
              </p>

              {arm.pullQuote && (
                <p
                  className="mt-2.5 italic text-text-secondary"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '16.5px',
                    lineHeight: 1.7,
                  }}
                >
                  {arm.pullQuote}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
