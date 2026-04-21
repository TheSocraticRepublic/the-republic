export default function ForumPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1
        className="text-xl font-bold tracking-tight text-neutral-100 mb-2"
        style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
      >
        Forum Content Policy
      </h1>
      <p className="text-xs text-neutral-500 mb-10">
        How this community moderates itself — and how to appeal a decision.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">What the Forum is For</h2>
          <div
            className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-4 text-sm text-neutral-400 leading-relaxed space-y-2"
          >
            <p>
              The Republic Forum is a space for people doing civic work — investigating public
              institutions, filing access to information requests, tracking policy outcomes, and
              organizing around shared concerns. It is a tool for democratic participation, not
              a general discussion platform.
            </p>
            <p>
              Good contributions connect to real investigations, cite sources, and help others
              navigate similar challenges. The standard is civic utility, not popularity.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">Moderation System</h2>
          <div
            className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-4 text-sm text-neutral-400 leading-relaxed space-y-2"
          >
            <p>
              There are no appointed moderators. Access to the moderation queue is earned through
              civic contribution — completing investigations, filing access requests, sharing
              responses, peer-reviewing others&apos; work. Users who reach a credential weight of
              10 or more can review flagged content.
            </p>
            <p>
              Every moderation action — hiding a post, locking a thread, dismissing a report — is
              recorded in an immutable audit log with a mandatory reason. Moderators cannot act
              on content they reported themselves.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">What Can Be Reported</h2>
          <div
            className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-4"
          >
            <ul className="space-y-2 text-sm text-neutral-400">
              <li className="flex gap-3">
                <span className="text-neutral-600 flex-shrink-0 w-24">Spam</span>
                <span>Promotional content, off-platform solicitation, repetitive posts.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-neutral-600 flex-shrink-0 w-24">Harassment</span>
                <span>Personal attacks, threats, coordinated targeting of individuals.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-neutral-600 flex-shrink-0 w-24">Misinformation</span>
                <span>
                  Demonstrably false claims about public officials, institutions, or policy
                  outcomes presented as fact.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-neutral-600 flex-shrink-0 w-24">Off topic</span>
                <span>Content unrelated to civic work or the investigation it&apos;s attached to.</span>
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">Appeals</h2>
          <div
            className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-4 text-sm text-neutral-400 leading-relaxed space-y-2"
          >
            <p>
              If your content is hidden and you believe it was done in error, you can appeal. The
              appeal re-queues the report for review by a different moderator — not the one who
              took the original action. You must provide a reason for the appeal.
            </p>
            <p>
              Appeals appear in the moderation queue with an &ldquo;Appeal&rdquo; badge. They follow the
              same process as any other report. There is one appeal per report.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-200 mb-3">Earning Moderator Access</h2>
          <div
            className="rounded-xl border border-white/[0.06] bg-black/30 px-5 py-4 text-sm text-neutral-400 leading-relaxed"
          >
            <p>
              Credential weight accumulates through diverse civic actions. A single path — for example,
              posting frequently to the forum — is not sufficient. The threshold of 10 is designed to
              require meaningful contributions across multiple areas. Credentials decay over time with
              inactivity, so moderation access reflects sustained participation, not historical
              contributions alone.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
