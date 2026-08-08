# Agent instructions

**The project's real instructions live in [`CLAUDE.md`](./CLAUDE.md).** Read that first —
architecture, design system, copy registers, and the critical rules are all there.

This file exists for one reason: to give `next dev` somewhere to write that isn't
`CLAUDE.md`.

## Why this file exists

Next.js 16's dev server writes a managed "agent rules" block into the project's agent
instruction file when it detects an AI coding agent and the block is missing
(`node_modules/next/dist/server/lib/generate-agent-files.js`). Its file preference is
explicit: **if `AGENTS.md` exists it writes here and skips `CLAUDE.md`** — the code path
returns `claudeMd: 'skipped'`. With only `CLAUDE.md` present, it wrote there instead, which
is how it turned up in a diff on 2026-08-07.

The block's content is benign and hardcoded in the package — it is not fetched at runtime,
so it cannot change without a Next.js release. The reason to redirect it anyway is the
mechanism rather than this instance: `CLAUDE.md` is the file whose entire purpose is
"instructions the agent obeys," and a dependency holding write access to it is a
directive-injection path. This project already treats that class of problem as real — Relay 3
shipped prompt-injection delimiters so hostile text inside an uploaded document could not
hijack the Gadfly's constraints. Same concern, arriving through the dependency tree.

So: the dependency gets this file to manage. The instructions we actually curate stay in
`CLAUDE.md`, and the working tree stops going dirty every time someone runs the dev server.

**Anything below the marker is written and maintained by Next.js, not by us.** Do not hand-edit
it; it is upserted in place on `next dev`. If it ever says something surprising, that is worth
looking at rather than accepting.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
