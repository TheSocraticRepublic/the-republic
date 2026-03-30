# The Republic

**Making institutional power legible.**

The Republic is an open-source civic AI framework that helps citizens understand government documents, develop critical analysis skills through Socratic inquiry, generate real civic actions, and compare policies across jurisdictions.

## The Four Arms

| Arm | Function |
|---|---|
| **Oracle** | Upload government documents. Get plain-language analysis, power maps, and the questions no one is asking. |
| **Gadfly** | Explore any document through Socratic inquiry. The Gadfly asks questions — it never gives answers. |
| **Lever** | Generate ready-to-file FOI requests, public comments, and policy briefs. |
| **Mirror** | Compare policies across jurisdictions. See what actually worked, where, and why. |

## Quick Start

```bash
git clone https://github.com/TheSocraticRepublic/the-republic.git
cd the-republic
cp .env.example .env.local
# Fill in your credentials
npm install
npm run dev
```

## Stack

Next.js 16 · React 19 · TypeScript · Drizzle ORM · PostgreSQL + pgvector · Claude API · Tailwind CSS 4 · Radix UI

## Philosophy

Read [PHILOSOPHY.md](PHILOSOPHY.md) to understand why this exists.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPLv3](LICENSE) — ensures institutional forks cannot strip transparency features.
