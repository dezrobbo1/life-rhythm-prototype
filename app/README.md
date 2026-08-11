# Life Rhythm `/app`

Status: Current React/Vite/TypeScript Personal Trial v1 architecture

This is the current implementation path for new Life Rhythm work. It does not replace the protected root `index.html`, `manifest.json`, or `service-worker.js` runtime. The root 1.4.6 app remains the live GitHub Pages legacy prototype.

Read the repository documentation map first:

- [`../docs/DOCUMENTATION_AUTHORITY.md`](../docs/DOCUMENTATION_AUTHORITY.md)
- [`docs/life-rhythm-current-design-spec.md`](docs/life-rhythm-current-design-spec.md)

## Current implementation

The latest application-code checkpoint is PR #109, merged through `81f4211dd6970ce08dc63d717a570111388876be`. The current `/app` implementation contains:

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
- data-class-specific backup export and read-only validation previews;
- quiet shared in-flow page headings;
- a compact shared header;
- a restrained local active-navigation marker;
- Pool as a content-led Soft Ledger / Holding Tray with ledger rows and dividers;
- a clarified Pool action hierarchy with Add to Today primary, Find soft window secondary and independent Other choices disclosures;
- Plan without the previous three equal-weight outer cards;
- a clear Day Shape → Soft suggestions → Soft placements reading order;
- Day Shape as the dominant connected planning object;
- quieter ruled suggestion and placement sections with consolidated scheduling-safety guidance;
- approved Plan mobile, desktop, populated-state, keyboard and theme-parity visual review.

## Current boundaries

The `/app` implementation does not provide:

- automatic scheduling or calendar writes;
- backend storage or cloud sync;
- AI-written task state or AI authority;
- notifications or analytics;
- import/restore execution;
- Workday/Non-workday profiles or profile-derived availability;
- persistent rhythm enablement or complete recurrence rules;
- repeating rhythm instances;
- broad parked/not-today/rhythm-instance resurfacing;
- external tester readiness.

PR #109 changed presentation only. It did not change selected-day behaviour; Day Shape content or ordering; explicit `openCapacity` behaviour; suggestion, eligibility or usefulness-window logic; user-confirmed placement or placement removal/reconfirmation; persistence, repositories, schemas, statuses, routes, task ordering or task lifecycle behaviour. It added no automatic scheduling, calendar writes, AI, backend, sync, notifications, analytics or restore/import behaviour.

## Proposed product-definition work — not implemented

- [`docs/day-profile-and-availability-contract.md`](docs/day-profile-and-availability-contract.md)
- [`docs/rhythm-recurrence-and-instance-contract.md`](docs/rhythm-recurrence-and-instance-contract.md)
- [`docs/rhythm-library-catalogue-gap-audit.md`](docs/rhythm-library-catalogue-gap-audit.md)

The next product step is approval of the day-profile/availability contract followed by the rhythm recurrence/instance contract. Implementation then proceeds through safe settings migration, derived work boundaries, persistent rhythm plans, stable generated instances, Plan integration and curated Library expansion. Today remains the next bounded visual object pass after that model work; Library and Setup remain later visual passes. The canonical sequence is in the [current design spec](docs/life-rhythm-current-design-spec.md#18-current-near-term-roadmap).

## Commands

```bash
npm ci
npm run dev
npm test
npm run build
```

Use a deterministic timezone when running date-sensitive tests. Test fixtures must not assume that a `Z` timestamp represents local wall-clock time.

The build output for `/app` is a preview artifact. It is not the root GitHub Pages deployment source.
