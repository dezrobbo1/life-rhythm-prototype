# Life Rhythm Agent Guidance

This file applies to the entire repository. More specific `AGENTS.md` files may add local guidance for a subtree; the closest applicable file wins.

## Start here

Before changing code, product behaviour, copy, data boundaries, or current-status documentation:

1. Read the root [README.md](README.md).
2. Read [docs/DOCUMENTATION_AUTHORITY.md](docs/DOCUMENTATION_AUTHORITY.md).
3. Read [app/docs/life-rhythm-current-design-spec.md](app/docs/life-rhythm-current-design-spec.md).
4. Read the relevant current contracts in [app/docs](app/docs), especially the object-grammar, visual-direction, navigation, persistence, backup, soft-scheduling, and trial-boundary documents for the task.
5. Check [app/docs/research/source-status.md](app/docs/research/source-status.md) before using research material to justify a product decision.
6. Inspect the current implementation and tests. Do not infer implemented behaviour from roadmaps, historical contracts, design boards, source prototypes, or screenshots.

Do not assume access to earlier ChatGPT conversations, uploaded PDFs, ZIP files, Library files, or external project folders. Durable decisions must exist in this repository. If required context is missing or current authority documents conflict, stop and identify the conflict rather than inventing a decision.

## Repository authority and application generations

The repository contains two deliberately separate app generations:

- Root `index.html`, `manifest.json`, and `service-worker.js` form the protected live Life Rhythm 1.4.6 legacy GitHub Pages PWA.
- `/app` is the current React/Vite/TypeScript Personal Trial architecture and the implementation path for new product work.

Do not rewrite, migrate, or copy behaviour from the legacy root app into `/app` unless the task explicitly authorizes it and the current design spec supports it. Do not change the legacy deployment path as a side effect of `/app` work.

The authority order is defined in [docs/DOCUMENTATION_AUTHORITY.md](docs/DOCUMENTATION_AUTHORITY.md). In summary:

1. The current design spec governs current `/app` product direction and implementation status.
2. Applicable current contracts govern bounded behaviour when they do not conflict with the design spec.
3. Evidence-balanced UX and research sources support rationale and traceability but do not expand implementation scope.
4. Historical contracts, visual boards, source prototypes, and the consolidated source archive do not override current authority.

## Product identity and non-negotiable boundaries

Life Rhythm is a local-first, non-clinical, private, user-led self-management product for adults with ADHD traits or an ADHD diagnosis.

Preserve the product centre:

> Power underneath. Calm on the surface.

Preserve the intended loop:

> capture → hold safely → find soft window → user confirms → re-enter later if missed or deferred → respect usefulness windows.

Do not introduce without a separately reviewed and approved contract:

- diagnosis, treatment, medical-outcome, therapy, coaching-authority, medication, crisis-support, or clinical-compliance behaviour;
- shame, failure, debt, overdue-pressure, streak, score, adherence, public-accountability, or productivity-punishment framing;
- automatic scheduling, automatic rescheduling, scheduler-owned placement, automatic Today movement, or automatic date changes;
- calendar writes, calendar ownership of the day, or treating blank time as available capacity;
- cloud sync, backend data storage, silent upload, analytics, telemetry containing user content, or cross-device merge;
- AI-written task state, AI coach authority, AI scheduling, biometric prediction, or neurochemical activation claims;
- notifications, task-history expansion, completion scoring, or import/restore execution.

The opt-in Clerk identity shell does not imply cloud sync or upload. Local data remains local and user-scoped under the current boundary.

## Current product and data guardrails

- Keep Today, Plan, Pool, and Library as the four primary destinations.
- Keep Reset and Settings as secondary destinations.
- Keep Plan a day-shape and soft-placement surface, not a backlog planner or calendar replacement.
- Keep Pool a safe Holding Tray, not an Inbox, Backlog, Queue, Pending list, or task-debt surface.
- Use only explicit `openCapacity` blocks for current soft suggestions and user-confirmed placement.
- A suggestion is not a placement. A placement is not a calendar event.
- Do not automatically add held, parked, not-today, or deferred items to Today.
- Preserve separate data-class boundaries for settings, Library rhythms, active Today tasks, Task Pool items, and soft placements.
- Backup checking is read-only. Restore/import execution is not implemented.
- Preserve explicit Task Pool status and `bringBackAfter` deferral metadata.
- Keep Zod validation, Dexie persistence, UI copy, backup formats, and tests consistent when an approved data contract changes.
- Treat local dates as local calendar dates. Tests must not assume a UTC `Z` timestamp represents local wall-clock time.

The consolidated `Life_Rhythm_All_Project_Sources_2026-07-12.zip` is provenance material, not runtime input. Do not add the archive, extracted duplicates, large binaries, generated previews, or source PDFs to the repository unless explicitly requested and reviewed.

## Visual and interaction guardrails

Follow:

- [app/docs/visual-design-direction-contract.md](app/docs/visual-design-direction-contract.md)
- [app/docs/object-grammar-spec.md](app/docs/object-grammar-spec.md)
- [app/docs/navigation-redesign-contract.md](app/docs/navigation-redesign-contract.md)
- [app/docs/theme-system-contract.md](app/docs/theme-system-contract.md)

The primary direction is Soft Ledger, supported by Holding Tray and the restrained Rhythm Notebook tone.

Prefer:

- ledger rows;
- holding trays;
- day bands;
- ruled sections;
- bottom sheets for short contextual choices;
- one dominant contained object where the object grammar calls for it;
- plain-language state and restrained metadata.

Avoid:

- generic AI, copilot, sparkle, magic-wand, or intelligence-gradient motifs;
- SaaS dashboards, productivity command centres, metrics, streaks, scores, and red overdue states;
- card soup, nested cards, pill-chip texture, generic icon badges, equal-weight panels, and excessive soft shadows;
- broad “make it beautiful,” “make it more ADHD-friendly,” or “match the board” implementation passes.

For UI work, name the product object, allowed surface, state and copy boundaries, forbidden states, and explicit non-goals. Prefer one bounded object-grammar change per PR. Automated tests and build output do not replace a desktop, mobile, and keyboard walkthrough.

## Repository map

- Root `index.html`, `manifest.json`, `service-worker.js`: protected live legacy PWA.
- `app/src`: current React/TypeScript implementation.
- `app/src/data`: Dexie, Zod, repositories, backup and validation boundaries.
- `app/src/features`: feature behaviour and tests.
- `app/src/screens`: current screen composition.
- `app/docs`: current product, data, persistence, trial, visual and interaction contracts.
- `app/docs/research`: source classification and evidence-governance guidance.
- `docs/DOCUMENTATION_AUTHORITY.md`: repository authority map and current baseline.
- `docs/ux`: evidence-balanced UX traceability.
- `docs/source-library`: source and provenance indexes.
- `docs/handover`: concise continuity notes; not a higher authority than the current design spec.

## Working rules

- Begin with `git status -sb` and preserve unrelated or pre-existing changes.
- Start new work from current `main` and use a focused branch and pull request. Do not work directly on `main`.
- Keep each PR focused on one reviewed outcome. Do not combine docs reconciliation, visual redesign, data-model expansion, and unrelated behaviour unless the outcome genuinely requires them.
- Prefer the smallest coherent change. Do not perform broad rewrites, dependency upgrades, formatting churn, or speculative abstractions without explicit scope.
- Follow nearby code patterns and update tests alongside behaviour.
- Update the current design spec and applicable contract in the same PR when a change alters implementation status, product boundaries, navigation, object grammar, persistence, backup scope, state transitions, privacy, or ownership.
- Mark historical documents as historical instead of rewriting them to look current.
- Use synthetic or explicitly approved sanitized fixtures only.
- Do not commit secrets, real user data, generated build output, source archives, unrelated binaries, or screenshots containing private data.
- Report assumptions, unavailable checks, and any difference between implemented behaviour, read-only preview, disabled control, and future contract.

## Validation

Run commands from `app` unless stated otherwise.

For a clean checkout or dependency-lock change:

```text
npm ci
```

For implementation, test, or current-contract changes:

```text
npm test
npm run build
```

When date, time, timezone, useful-window, deferral, suggestion, or placement logic changes, run the test suite in both UTC and Australia/Perth using the shell's environment-variable syntax.

POSIX shells:

```text
TZ=UTC npm test
TZ=Australia/Perth npm test
```

Windows PowerShell:

```text
$env:TZ = 'UTC'; npm test
$env:TZ = 'Australia/Perth'; npm test
Remove-Item Env:TZ -ErrorAction SilentlyContinue
```

For every change, run from the repository root:

```text
git diff --check
```

For UI changes, also complete and report a manual desktop, narrow/mobile, and keyboard walkthrough of the affected flow. The `/app` build is a preview artifact and is not the root GitHub Pages deployment source.

Docs-only changes do not require the full app test suite unless they alter executable examples, build instructions, implementation claims that need code verification, or another applicable rule requires it. They still require link/path review, status consistency review, and `git diff --check`.

## Definition of done

A change is complete only when:

- its scope and non-goals are explicit;
- implementation, tests, current contracts, and status documents agree;
- product, privacy, local-first, non-clinical, user-confirmed, visual, and legacy-runtime boundaries remain intact;
- relevant automated and manual checks pass, or unavailable checks are clearly identified;
- the PR explains what changed, why, what was verified, and what remains deliberately unimplemented.
