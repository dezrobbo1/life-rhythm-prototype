# Life Rhythm `/app`

Status: Current React/Vite/TypeScript Personal Trial v1 architecture

This is the current implementation path for new Life Rhythm work. It does not replace the protected root `index.html`, `manifest.json`, or `service-worker.js` runtime. The root 1.4.6 app remains the live GitHub Pages legacy prototype.

Read the repository documentation map first:

- [`../docs/DOCUMENTATION_AUTHORITY.md`](../docs/DOCUMENTATION_AUTHORITY.md)
- [`docs/life-rhythm-current-design-spec.md`](docs/life-rhythm-current-design-spec.md)

## Current implementation

The merged `/app` baseline through PR #106 currently contains:

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

The open PR #107 branch `codex/visual-foundation-pool-soft-ledger` at checkpoint `601a691d9dfc1dfd0c846a53384b3c599649af7b` additionally implements, on that branch:

- quiet shared in-flow page headings;
- a compact shared header;
- a restrained local active-navigation marker;
- Pool as a content-led Soft Ledger / Holding Tray with ledger rows and dividers;
- a clarified Pool action hierarchy with Add to Today primary, Find soft window secondary and independent Other choices disclosures.

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

`main` is at `3ae432eaa69879463fe0587aedbb313d81f0af43` after PR #106. PR #107 remains open and is not part of the merged baseline. Its branch checkpoint leaves capture behaviour, action meaning and order, persistence, schemas, routes, task ordering, task lifecycle behaviour, placement ownership and the boundaries above unchanged. If PR #107 merges, the next bounded visual work is Plan card-soup and pill-chip reduction followed by Today dominant-active-object refinement; Library and Setup remain later bounded passes.

## Commands

```bash
npm ci
npm run dev
npm test
npm run build
```

Use a deterministic timezone when running date-sensitive tests. Test fixtures must not assume that a `Z` timestamp represents local wall-clock time.

The build output for `/app` is a preview artifact. It is not the root GitHub Pages deployment source.
