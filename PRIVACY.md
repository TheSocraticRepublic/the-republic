# Privacy Policy — The Republic

The Republic is a tool for civic accountability. The data it handles belongs to citizens
exercising their democratic rights. This document describes exactly what is collected,
what is deliberately not collected, and what happens to your data.

The user-facing version of this policy is served in-app at `/privacy` (opencave.ca/privacy).
Keep the two in sync.

---

## What The Republic Collects

**Accounts**
An account consists of your email address and a display name you choose. Email is used only
for authentication. It is never sold, shared with advertisers, or used for marketing.

**Investigations**
When you open an investigation, we store the concern you described, the jurisdiction you
selected, the postal code you provided (used to look up your federal MP), documents you
uploaded or linked, and the outputs produced (briefings, lever actions, campaign materials).
Investigations are linked to your account.

**Forum Posts**
Posts and threads you create are stored and attributed to your display name. You may delete
a post; the content is removed and the post becomes authorless. Thread structure (reply
counts, timestamps) is retained for continuity.

**Credentials**
Civic participation earns credential events — a lightweight record of action type, weight,
and source reference. These aggregate into a credential score used for governance weight.
No credential record contains surveillance data.

**Feedback**
When you submit a bug report or suggestion, we store the feedback type, description, and
the page you were on at submission time. Feedback is linked to your account if you are
signed in.

**Archive Records**
When an investigation is submitted for archiving, a bundle is created and pinned to IPFS
and Arweave. The archive record stores the CID and transaction ID alongside your user ID.
Archive records persist as public goods even if your account is deleted (see below).

---

## What The Republic Does NOT Collect or Log

The following are deliberately outside The Republic's data model. They are not stored,
not logged, not retained in any form:

- **Investigation reads** — opening or browsing an investigation generates no server record
- **Search queries** — what you search for is not logged
- **Document downloads** — accessing a document leaves no audit trail tied to you
- **Gadfly session content** — the content of socratic dialogue sessions is not logged at
  the event level (session metadata is stored; turn content is stored for session continuity,
  but session content events are prohibited from system-level logging)
- **Briefing content** — the AI-generated briefings you receive are not logged as read events
- **Forum post drafts** — text you type but do not submit is never transmitted or stored

This is not a policy aspiration — it is enforced at the data model level. These fields do
not exist in the schema. You cannot accidentally log what there is no column to store.

The system logging policy distinguishes two categories: events that may be logged
(`auth_failure`, `rate_limit_violation`, `moderation_action`, `credential_award`,
`archive_creation`, `permanence_promotion`) and events that are explicitly prohibited from
logging. These are enforced in code via `src/lib/privacy/logging-policy.ts`.

---

## How Data is Stored

**PostgreSQL (primary database)**
Your account, investigations, documents, forum posts, credentials, and governance records
live in a PostgreSQL database. Access requires authentication. The application connects with
a scoped service key; no client-side database access is possible.

**Voyage AI (embedding processor, operator-configured)**
When an operator configures a Voyage AI API key, document text submitted at ingest and
concern-derived query text submitted at briefing time are sent to Voyage AI's API to
generate vector embeddings used for semantic search. This transmission occurs only when
`VOYAGE_API_KEY` is set by the operator; without it, semantic search is disabled and no
text leaves the application for embedding purposes. Voyage AI's data handling is governed
by their own privacy policy.

**IPFS (distributed archive, pinned)**
When an investigation is archived, a content bundle is pinned to IPFS. IPFS content is
addressable by hash and publicly accessible by anyone with the CID. This is intentional —
archiving is a commitment to permanence and public access. Do not submit an investigation
for archiving if you do not want the content publicly accessible.

**Arweave (permanent archive)**
Investigations promoted to permanence are written to Arweave, a blockchain-based permanent
storage network. Arweave records cannot be deleted by The Republic or anyone else. This
permanence is the point: government documents and civic records should survive institutional
pressure to disappear them. The tradeoff is finality — permanence is irreversible.

---

## Third-Party Processors

Open Cave relies on a small number of US-based service providers. Each receives only what it
needs to do its job:

- **Anthropic (Claude)** — when you run an analysis, the text of your concern, relevant
  document content, and parliamentary context are sent to Anthropic's API to generate the
  analysis. This is the most sensitive transfer the tool makes; it occurs only when you invoke
  an AI feature.
- **Voyage AI** — when an operator configures `VOYAGE_API_KEY`, document and query text are sent
  to generate vector embeddings for semantic search. Without the key, no text leaves for
  embedding.
- **Resend** — your email address is sent to Resend to deliver your sign-in code.
- **Sentry** — error monitoring. Request bodies, cookies, auth headers, and your email/IP are
  stripped from every report before it is sent; session replay is disabled.
- **Upstash** — a Redis service used only to rate-limit requests and block abuse and
  cost-attacks. It receives your IP address (and, for some limits, your account ID) as a
  rate-limit key plus a short-lived counter — never your content, searches, or which pages you
  open. Counters auto-expire within minutes to a day, no usage analytics are collected, and they
  are used for nothing else.

## Data Residency

Your data is stored and processed in the **United States** (Supabase PostgreSQL, region
us-east-2), and the processors above are US-based. Your personal information is therefore
subject to US law, including lawful-access requests by US authorities. Canadian privacy law
(PIPEDA) permits cross-border processing, but you have the right to know it occurs. If US
storage is unacceptable for your threat model, do not submit sensitive material.

## Account Deletion

You can delete your account from your profile. When you do:

- Your user record and profile are deleted
- Your investigations and the documents linked to them are deleted
- Your forum posts and threads are deleted
- Your credential events are deleted
- Your feedback submissions are deleted

This cascade is permanent and cannot be undone. The one exception: content you submitted for
public archiving is already pinned to IPFS and/or written to Arweave, which are immutable.
Deleting your account removes our database pointer to it, but the public archived content
itself cannot be retracted from those networks.

---

## ActivityPub Data

The Republic federates over ActivityPub. When you publish forum content, the following
is shared with the fediverse:

- Your display name and actor URL (`/ap/users/{displayName}`)
- Post content you mark as public
- Thread titles for threads you create

The following stays local and is never federated:

- Your email address
- Your investigation contents and documents
- Your credential score and breakdown
- Your governance votes
- Private or unlisted posts

ActivityPub is a public protocol. Content shared via ActivityPub may be cached, mirrored,
or indexed by other servers. Apply the same judgment you would to any public post.

---

## No Advertising, No Tracking, No Analytics

The Republic runs no analytics and loads no advertising or tracking scripts — no Google
Analytics, no Meta Pixel, no Intercom, no Segment, no Hotjar, no session recording, no A/B
testing framework.

The one third-party script that runs in your browser is Sentry's error-monitoring SDK, used
to catch crashes. It is not advertising or analytics, and request bodies, cookies, auth
headers, and your email/IP are stripped from every report before it leaves your browser (see
Third-Party Processors above). Session replay is disabled.

The rate-limiting service (Upstash) keeps only ephemeral per-IP and per-account request counters
for abuse prevention. Its own usage-analytics feature is disabled, so no per-user activity
telemetry is retained. A `rate_limit_violation` may be logged as a security event (see the
logging policy above), but the substance of what you read, search, or open is not.

There are no cookies beyond the session cookie required for authentication. The session
cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`.

No data is sold or shared with any third party for advertising or commercial purposes.

---

## Data Retention

The Republic does not operate on a time-based retention schedule. Data is retained
indefinitely until you delete it or delete your account. Specific postures by type:

- **Investigations, documents, forum posts, credentials:** retained until account deletion
  or explicit user deletion. Account deletion cascades to all owned rows.
- **Feedback:** retained until account deletion.
- **Magic codes (sign-in codes):** expire after a short window (set at issue time) and
  are also purged from the database when your account is deleted.
- **Archive records (IPFS/Arweave):** our database pointer is deleted with your account,
  but content already written to those networks cannot be retracted (see Archive Records above).
- **Governance records:** governance proposals and their outcomes form part of the public
  governance ledger and are retained indefinitely. Your individual votes are tied to your
  account and are deleted when you delete your account (the vote rows are removed via
  cascade, not anonymized or left with a null reference).

Expired magic codes are purged automatically by a scheduled job (runs every few minutes;
removes codes more than a day past expiry). Data tied to a deleted account is removed by
cascade at deletion time.

---

## Your Rights

You can view the data tied to your account in the app, correct your display name, and
withdraw consent at any time by deleting your account (which erases your data — see Account
Deletion above). For a copy of your data or any privacy question, contact us; we respond to
access requests within 30 days. We require nothing beyond an email to use the tool.

---

## Contact

Questions about privacy or data handling: open an issue on the public repository or reach
out through the forum. We will respond.

Last updated: 2026-06-28
