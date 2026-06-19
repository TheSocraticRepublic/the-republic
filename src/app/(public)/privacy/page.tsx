const DISPLAY_FONT = '"Plus Jakarta Sans", system-ui, sans-serif'

export const metadata = {
  title: 'Privacy',
  description:
    'What Open Cave collects, what it deliberately does not, who processes it, and where it lives.',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2
        className="text-base font-semibold tracking-tight text-text-primary"
        style={{ fontFamily: DISPLAY_FONT }}
      >
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <article>
      <header className="mb-8">
        <h1
          className="text-xl font-bold tracking-tight text-text-primary"
          style={{ fontFamily: DISPLAY_FONT }}
        >
          Privacy Policy
        </h1>
        <p className="mt-0.5 text-xs text-text-muted">Last updated 2026-06-19</p>
      </header>

      <p className="text-sm leading-relaxed text-text-secondary">
        Open Cave is a tool for civic accountability. The data it handles belongs to citizens
        exercising their democratic rights. This page describes exactly what is collected, what
        is deliberately not collected, who processes it, and where it is stored.
      </p>

      <Section title="What we collect">
        <p>
          <strong className="text-text-primary">Accounts.</strong> Your email address (used only
          to send sign-in codes — never sold, never used for marketing) and a display name you
          choose.
        </p>
        <p>
          <strong className="text-text-primary">Investigations.</strong> The concern you describe,
          the jurisdiction you select, documents you upload or link, your postal code when you use
          it to find a representative, and the outputs produced (briefings, lever actions, campaign
          materials). Linked to your account.
        </p>
        <p>
          <strong className="text-text-primary">Forum posts &amp; credentials.</strong> Posts you
          create (attributed to your display name) and a lightweight record of civic actions
          (type, weight, source) that aggregates into a credential score. No surveillance data.
        </p>
        <p>
          <strong className="text-text-primary">Archive records.</strong> If you submit an
          investigation for archiving, a bundle is pinned to IPFS and Arweave. These are public and
          permanent by design and persist even if you delete your account (see below).
        </p>
      </Section>

      <Section title="What we deliberately do NOT collect or log">
        <p>
          These are outside the data model — there is no column to store them: investigation
          reads, search queries, document downloads, briefing-read events, and unsent post drafts.
          You cannot accidentally log what there is nowhere to put.
        </p>
      </Section>

      <Section title="Third parties that process your data">
        <p>
          Open Cave relies on a small number of service providers to function. Each receives only
          what it needs, and all are US-based — see data residency below.
        </p>
        <ul className="ml-4 list-disc space-y-2 marker:text-text-faint">
          <li>
            <strong className="text-text-primary">Anthropic (Claude).</strong> When you run an
            analysis, the text of your concern, relevant document content, and parliamentary
            context are sent to Anthropic&apos;s API to generate the analysis. This is the most
            sensitive transfer we make; it happens only when you invoke an AI feature.
          </li>
          <li>
            <strong className="text-text-primary">Voyage AI.</strong> When semantic search is
            enabled, document text and query text are sent to generate vector embeddings.
          </li>
          <li>
            <strong className="text-text-primary">Resend.</strong> Your email address is sent to
            Resend to deliver your sign-in code.
          </li>
          <li>
            <strong className="text-text-primary">Sentry.</strong> Error monitoring. Sentry&apos;s
            client SDK runs in your browser to report crashes. We strip request bodies, cookies,
            auth headers, and your email/IP from every report before it is sent, and session
            replay is disabled.
          </li>
        </ul>
        <p>
          We do not sell your data or share it with advertisers. We load no advertising or tracking
          scripts and run no analytics — there are no cookies beyond the single sign-in cookie
          (<code className="text-text-muted">HttpOnly</code>,{' '}
          <code className="text-text-muted">Secure</code>,{' '}
          <code className="text-text-muted">SameSite=Lax</code>).
        </p>
      </Section>

      <Section title="Where your data is stored (data residency)">
        <p>
          Your account, investigations, documents, posts, and credentials live in a PostgreSQL
          database hosted in the <strong className="text-text-primary">United States</strong>{' '}
          (Supabase, us-east-2). The processors above (Anthropic, Voyage, Resend, Sentry) are also
          US-based.
        </p>
        <p>
          This means your personal information is stored and processed in the United States and is
          subject to US law, including lawful-access requests by US authorities. Canadian privacy
          law (PIPEDA) permits this, but you have the right to know it. If US storage is
          unacceptable for your threat model, do not submit sensitive material.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You may access the data tied to your account, correct your display name, withdraw consent
          by deleting your account, and contact us with any privacy question. We do not require any
          information beyond an email to use the tool.
        </p>
      </Section>

      <Section title="Account deletion">
        <p>
          You can delete your account from your profile. When you do, your account and everything
          tied to it is permanently removed — your investigations, documents, forum posts and
          threads, and credential records. This cannot be undone.
        </p>
        <p>
          Archive records you created <strong className="text-text-primary">persist</strong> — once
          pinned to IPFS or written to Arweave they exist as public goods and cannot be retracted.
          Deleting your account will not remove them.
        </p>
      </Section>

      <Section title="ActivityPub federation">
        <p>
          When you publish public forum content, your display name, actor URL, public post content,
          and thread titles are shared with the fediverse and may be cached or mirrored by other
          servers. Your email, investigation contents, credential score, governance votes, and any
          private posts are never federated.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about privacy or data handling: open an issue on the public repository or reach
          out through the forum. This policy mirrors the canonical{' '}
          <code className="text-text-muted">PRIVACY.md</code> in the open-source repository.
        </p>
      </Section>
    </article>
  )
}
