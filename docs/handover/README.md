# Life Rhythm handover

Use this folder for continuity notes between research, design, implementation and Codex work.

## Current status

- Root `index.html` remains the protected public 1.4.6 legacy PWA.
- `/app` is the current React/Vite/TypeScript local-first Personal Trial v1 architecture.
- Merged baseline: `main` at `3ae432eaa69879463fe0587aedbb313d81f0af43` after PR #106.
- Open review checkpoint: PR #107 from `codex/visual-foundation-pool-soft-ledger` at `601a691d9dfc1dfd0c846a53384b3c599649af7b`; draft and not merged.
- Current product authority: `app/docs/life-rhythm-current-design-spec.md`.
- Current documentation map: `docs/DOCUMENTATION_AUTHORITY.md`.
- Current source provenance bundle: `Life_Rhythm_All_Project_Sources_2026-07-12.zip` supplied for the 2026-07-12 consolidation.

## Current implementation rule

Do not rewrite the live 1.4.6 app in place. New work belongs in `/app` and must preserve local-first, non-clinical, user-confirmed and no-calendar-write boundaries.

The current `/app` loop includes Today, Plan, Pool and Library, Pool capture/holding, Pool-based open-capacity suggestions, user-confirmed soft placement, data-class-specific backup export/check paths including Task Pool status and deferral metadata, and local persistence for approved data classes. PR #106 is merged. PR #107 is open from `codex/visual-foundation-pool-soft-ledger` at checkpoint `601a691d9dfc1dfd0c846a53384b3c599649af7b` and implements, on that branch, quiet shared in-flow headings, a compact shared header, a restrained local navigation marker, Pool as a Soft Ledger / Holding Tray with ledger rows and dividers, and a clarified Pool action hierarchy; it is not yet merged. If it merges, the next bounded visual sequence is Plan card-soup and pill-chip reduction, then Today dominant-active-object refinement, with Library and Setup later. Capture behaviour, action meaning and order, persistence, schemas, routes, task ordering, task lifecycle behaviour, user-confirmed placement and the prohibition on automatic scheduling remain unchanged. Repeating rhythm instances, broader resurfacing, `askFirst` placement, calendar integration, AI, backend, sync, notifications, analytics and restore/import execution remain future work.

## Evidence rule

Use the feature-specific packet anchors in the v1.2 evidence-balanced design spec. Packets 22 and 25 are global constraints, not default evidence for every feature.
