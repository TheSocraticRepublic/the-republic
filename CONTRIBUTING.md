# Contributing

The Republic is open source under AGPLv3. Contributions are welcome.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Copy `.env.example` to `.env.local` and fill in credentials
4. `npm install`
5. `npm run dev`

## Development

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm test` — Run unit tests
- `npm run test:watch` — Run tests in watch mode

## Architecture

The Republic has four arms, each with its own API routes, components, and AI prompt:

- **Oracle** (`/oracle`) — Document analysis
- **Gadfly** (`/gadfly`) — Socratic inquiry
- **Lever** (`/lever`) — Civic action generation
- **Mirror** (`/mirror`) — Cross-jurisdiction comparison

Each arm follows the same pattern:
- System prompt in `src/lib/ai/prompts/`
- API routes in `src/app/api/{arm}/`
- Pages in `src/app/(app)/{arm}/`
- Components in `src/components/{arm}/`

## Key Principles

- The Gadfly NEVER answers its own questions
- The Lever uses template-based legal citations (never AI-generated)
- The Oracle is a lens, not an advocate
- The Mirror only cites real jurisdictions with real data

Read [PHILOSOPHY.md](PHILOSOPHY.md) before contributing. The design decisions are not arbitrary — they follow from the philosophical commitments described there.

## Pull Requests

- One feature per PR
- Include tests for new functionality
- Follow existing code patterns
- New arm features must pass the Illich test (see PHILOSOPHY.md)
