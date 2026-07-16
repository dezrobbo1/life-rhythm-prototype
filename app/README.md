# Life Rhythm `/app`

Status: Current React/Vite/TypeScript Personal Trial v1 architecture

This is the current implementation path for new Life Rhythm work. It does not replace the protected root `index.html`, `manifest.json`, or `service-worker.js` runtime. The root 1.4.6 app remains the live GitHub Pages legacy prototype.

Read the repository documentation map first:

- [`../docs/DOCUMENTATION_AUTHORITY.md`](../docs/DOCUMENTATION_AUTHORITY.md)
- [`docs/life-rhythm-current-design-spec.md`](docs/life-rhythm-current-design-spec.md)

## Current implementation

The `/app` branch currently contains:

- Today, Plan, Pool and Library as the four primary destinations;
- Reset and Settings as secondary destinations;
- React/Vite/TypeScript app shell and semantic theme tokens;
- Dexie local persistence with Zod validation;
- settings and Life Shape persistence;
- custom Library rhythm persistence;
- active Today task and status persistence;
- Task Pool capture, safe holding, deferral and Pool-to-Today movement;
- Pool-based soft suggestions from explicit `openCapacity` blocks;
- user-confirmed local soft placements and safe removal/reconfirmation;
- Task Pool backup export and read-only validation, including saved status and deferral metadata;
- opt-in Clerk identity shell with separate local namespaces, but no sync;
- data-class-specific backup export and read-only validation previews.

## Current boundaries

The `/app` implementation does not provide:

- automatic scheduling or calendar writes;
- backend storage or cloud sync;
- AI-written task state or AI authority;
- notifications or analytics;
- import/restore execution;
- repeating rhythm instances;
- broad parked/not-today/rhythm-instance resurfacing;
- external tester readiness.

PR #105 is merged into `main` at `553b83f`. The bounded Task Pool backup path, timezone-safe UTC/Perth verification and documentation synchronization are part of the current baseline. The next work is fresh visual/product validation followed by bounded Pool → Plan → Today hierarchy refinement.

## Commands

```bash
npm ci
npm run dev
npm test
npm run build
```

Use a deterministic timezone when running date-sensitive tests. Test fixtures must not assume that a `Z` timestamp represents local wall-clock time.

The build output for `/app` is a preview artifact. It is not the root GitHub Pages deployment source.
