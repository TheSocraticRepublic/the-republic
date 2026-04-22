# The Republic

**Civic AI that makes institutional power legible.**

The Republic is an open-source framework for citizens who have hit the wall: the environmental assessment that takes three weeks to read, the municipal budget no one can parse, the FOI request you don't know how to file. It collapses the cost of comprehension — not by replacing the citizen's judgment, but by doing the mechanical work that has always required a lawyer or a researcher.

## Architecture

The Republic has two parts that work together.

### The Cave

Where investigation happens. Three layers that compose into a complete civic inquiry:

**Investigation Engine** — The citizen's working space. Upload government documents, identify players and interests, run structured analysis. The Scout gathers and searches. The Oracle analyzes: plain-language summaries, power maps, funding sources, what's missing and why. The Mirror finds jurisdictions that already solved the problem — not as inspiration but as evidence that alternatives exist.

**The Lens** — Makes patterns visible across an investigation. Gadfly surfaces Socratic questions that push analysis deeper. Players maps the actors: who benefits, who decides, who is affected. Context tracks related events, legislative history, and policy timelines.

**The Campaign** — Turns analysis into action. Lever generates real, fileable documents: FIPPA requests with precise statutory citations, public hearing comments, policy briefs. Media specs and talking points for public mobilization. Coalition templates for organizing.

### The Forum

Where citizens deliberate. A pseudonymous, credential-gated discussion layer built on top of the Cave.

- **Threads** linked to investigations — conversation grounded in analysis, not speculation
- **Peer review** — five-dimension structured assessment of investigation quality (factual accuracy, source quality, missing context, strategic effectiveness, jurisdictional accuracy)
- **Credentials** — earned through civic action, not social performance. Decay with inactivity. Soulbound — no transfers, no marketplace
- **Moderation** — credential-weighted. No central administrator with unilateral power
- **Federation** — ActivityPub integration. Republic users are discoverable on Mastodon and other Fediverse instances. An institution cannot de-platform a federated network

## Quick Start

Requirements: Node 22+, PostgreSQL 16+ (or Supabase)

```bash
git clone https://github.com/TheSocraticRepublic/the-republic.git
cd the-republic
npm install
cp .env.example .env.local
# Fill in your credentials (see .env.example for required variables)
npx drizzle-kit push
npm run dev
```

In development, magic codes are printed to the terminal (email delivery is not configured by default).

Open [http://localhost:3000](http://localhost:3000). Enter your email. The magic code auth system requires no password.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full environment setup guide.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Database | Drizzle ORM, PostgreSQL with pgvector |
| AI | Anthropic Claude via AI SDK (streaming) |
| Auth | Magic code, JWT (jose), no passwords |
| Rate limiting | Upstash Redis |
| Federation | ActivityPub, HTTP Signatures (jose) |
| Search | Tavily |
| UI | Tailwind CSS 4, Radix UI |
| Testing | Vitest |
| Deploy | Netlify |

## Features

What a citizen can do:

- Upload government documents and get plain-language analysis with power maps
- Explore documents through Socratic questioning (the system asks, never answers)
- Generate real FOI requests citing the precise statutory sections that compel a response
- Compare policies across jurisdictions — find who already solved the problem
- Start investigations that track players, events, and outcomes over time
- Discuss findings pseudonymously in the Forum
- Submit peer reviews of other citizens' investigations
- Earn credentials through actual civic action
- Follow Republic users from Mastodon or any Fediverse client

## Jurisdiction Support

Jurisdiction modules define the FOI framework, public bodies, concern categories, and environmental assessment process for a specific province or territory.

| Jurisdiction | Status | Notes |
|---|---|---|
| British Columbia | Verified | FIPPA citations verified against current statute. BC IPC guidance incorporated. |
| Alberta | Unverified | Module present. FOIP citations have not been reviewed by a BC/AB practitioner. Use with caution. |
| Ontario | Unverified | Module present. MFIPPA/FIPPA citations have not been reviewed by an ON practitioner. Use with caution. |

Unverified jurisdictions display a runtime warning. Adding a verified jurisdiction module is the most impactful contribution this project accepts. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Federation

The Republic implements ActivityPub. Users with a display name become discoverable as `@handle@yourdomain.com` on Mastodon and other Fediverse instances.

**What works today:** WebFinger discovery, actor profiles, HTTP Signature-verified delivery to remote followers.

**What's coming:** Outbox for investigation summaries, inbox for cross-instance discussion.

**Warning:** `AP_DOMAIN` is immutable once set. Changing it severs all existing actor identities. There is no migration path. Treat it like a primary key. See [SECURITY.md](SECURITY.md).

## Philosophy

Read [PHILOSOPHY.md](PHILOSOPHY.md) to understand why this exists and what design principles govern every feature decision.

The short version: Ivan Illich argued that tools should make people more capable without the tool. Every feature in The Republic must pass that test. If using this system makes people dependent on this system, it has failed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

The highest-value contribution is a verified jurisdiction module. If you know the FOI law in your province, you can make this tool genuinely useful for every citizen there.

## License

[AGPLv3](LICENSE) — ensures that any institution that deploys a modified version of this tool must release their modifications under the same license. The tools of legibility must themselves remain legible. An organization cannot fork The Republic, strip the transparency features, and deploy it as a capture mechanism.
