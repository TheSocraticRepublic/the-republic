# Privacy Policy — The Republic

The Republic is a tool for civic accountability. The data it handles belongs to citizens
exercising their democratic rights. This document describes exactly what is collected,
what is deliberately not collected, and what happens to your data.

---

## What The Republic Collects

**Accounts**
An account consists of your email address and a display name you choose. Email is used only
for authentication. It is never sold, shared with advertisers, or used for marketing.

**Investigations**
When you open an investigation, we store the concern you described, the jurisdiction you
selected, documents you uploaded or linked, and the outputs produced (briefings, lever
actions, campaign materials). Investigations are linked to your account.

**Forum Posts**
Posts and threads you create are stored and attributed to your display name. You may delete
a post; the content is removed and the post becomes authorless. Thread structure (reply
counts, timestamps) is retained for continuity.

**Credentials**
Civic participation earns credential events — a lightweight record of action type, weight,
and source reference. These aggregate into a credential score used for governance weight.
No credential record contains surveillance data.

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

## Account Deletion

When you delete your account:

- Your user record is deleted
- All investigations you created are cascade-deleted
- All documents linked only to your investigations are cascade-deleted
- Forum posts are made authorless — content is retained for thread continuity, attribution
  is removed
- Credential events tied to your account are deleted
- Archive records you created persist — they exist as public goods and cannot be retracted
  from IPFS or Arweave once pinned

If you have investigations with pending or completed archive records, you should be aware
that deleting your account will not remove those records from public storage.

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

## No Tracking, No Analytics, No Third-Party Scripts

The Republic loads no third-party JavaScript. There is no Google Analytics, no Meta Pixel,
no Intercom, no Segment, no Hotjar, no session recording tool, no A/B testing framework.

There are no cookies beyond the session cookie required for authentication. The session
cookie is `HttpOnly`, `Secure`, and `SameSite=Lax`.

No data is sold or shared with any third party for any commercial purpose.

---

## Contact

Questions about privacy or data handling: open an issue on the public repository or reach
out through the forum. We will respond.

Last updated: 2026-04-22
