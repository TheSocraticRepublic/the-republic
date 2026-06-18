import { ArrowUpRight } from 'lucide-react'

export const metadata = {
  title: 'Foundations',
  description:
    'The philosophical groundwork that conceived Open Cave — five papers, one argument in five movements.',
}

const DISPLAY_FONT = '"Plus Jakarta Sans", system-ui, sans-serif'

interface Paper {
  numeral: string
  title: string
  slug: string
  argument: string
  words: string
}

const PAPERS: Paper[] = [
  {
    numeral: 'I',
    title: 'The Examined Institution',
    slug: 'the-examined-institution',
    argument:
      'The problem: institutions are broken because their foundations are false. Twenty-five centuries of philosophy meet a hundred years of physics.',
    words: '10,400 words',
  },
  {
    numeral: 'II',
    title: 'The Participatory Universe',
    slug: 'the-participatory-universe',
    argument:
      'The proof: physics demolished the Newtonian metaphysics that political philosophy still runs on. What comes after Newton.',
    words: '6,100 words',
  },
  {
    numeral: 'III',
    title: 'The Convergent Methods',
    slug: 'the-convergent-methods',
    argument:
      'The precedent: ancient traditions described quantum reality without the math. The epistemological monopoly is false.',
    words: '4,300 words',
  },
  {
    numeral: 'IV',
    title: 'The New Republic',
    slug: 'the-new-republic',
    argument:
      'The vision: what governance, economy, education, justice, and identity look like when built on foundations that are not false.',
    words: '4,700 words',
  },
  {
    numeral: 'V',
    title: 'The Mixed Constitution',
    slug: 'the-mixed-constitution',
    argument:
      'The stress test: the philosopher-king returns in five modern costumes and fails five times. Machines as civil service, never sovereign.',
    words: '5,900 words',
  },
]

export default function FoundationsPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-xl font-bold tracking-tight text-text-primary"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          The Groundwork
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">
          The philosophy that conceived Open Cave — one argument in five movements.
        </p>
      </div>

      {/* Lineage preface — resolves the naming (Open Cave / The Republic / Plato) */}
      <div
        className="mb-10 border-l-2 pl-5"
        style={{ borderColor: 'var(--accent-gadfly)' }}
      >
        <p className="text-sm leading-relaxed text-text-secondary">
          <strong className="font-semibold text-text-primary">Open Cave</strong> is the
          tool. <strong className="font-semibold text-text-primary">The Republic</strong>{' '}
          is the vision it serves — the project of turning around, away from the shadows on
          the wall. Both names come from Plato: the Cave we are leaving, the Republic we are
          trying to build without a philosopher-king.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          These five papers are the philosophical foundation the project was built on,
          written in dialogue over 2026. They are a record of the thinking, not a manual for
          the software — read them as the argument that had to hold before a line of code
          was worth writing.
        </p>
      </div>

      {/* Papers */}
      <section className="space-y-3">
        {PAPERS.map((paper) => (
          <a
            key={paper.slug}
            href={`/foundations/${paper.slug}.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="card-lift group block rounded-xl border border-border bg-surface-1 shadow-sm px-5 py-4 transition-all duration-150 hover:bg-surface-3 hover:border-border-strong"
          >
            <div className="flex items-start gap-4">
              {/* Roman numeral */}
              <span
                className="flex-shrink-0 pt-0.5 text-lg font-semibold tabular-nums"
                style={{ fontFamily: DISPLAY_FONT, color: 'var(--accent-gadfly)' }}
              >
                {paper.numeral}
              </span>

              {/* Title + argument + meta */}
              <div className="min-w-0 flex-1">
                <h2
                  className="text-base font-semibold tracking-tight text-text-primary"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  {paper.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  {paper.argument}
                </p>
                <p className="mt-1.5 text-xs text-text-faint">
                  Paper {paper.numeral} · {paper.words}
                </p>
              </div>

              {/* External-link affordance */}
              <ArrowUpRight
                size={16}
                strokeWidth={1.75}
                className="flex-shrink-0 mt-1 text-text-faint transition-colors group-hover:text-text-secondary"
              />
            </div>
          </a>
        ))}
      </section>

      {/* Footnote — convivial / transparent */}
      <p className="mt-8 text-xs leading-relaxed text-text-faint">
        Each paper opens as a self-contained reading. The wider corpus — the sourcebooks,
        physics research, and design notes behind these five — is open, like everything
        here.
      </p>
    </>
  )
}
