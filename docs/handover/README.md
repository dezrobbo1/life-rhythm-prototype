# Life Rhythm handover

Use this folder for continuity notes between research, design, implementation and Codex work.

## Current status

- Root `index.html` remains the protected public 1.4.6 legacy PWA.
- `/app` is the current React/Vite/TypeScript local-first Personal Trial v1 architecture.
- Merged baseline: `main` at `e11d6d5022a6118f96712b48ef5776d0a6acffbd` after PR #107.
- Latest merged visual checkpoint: PR #107 — Visual Foundation Pass 1 / Soft Ledger shell and Pool.
- Current product authority: `app/docs/life-rhythm-current-design-spec.md`.
- Current documentation map: `docs/DOCUMENTATION_AUTHORITY.md`.
- Current source provenance bundle: `Life_Rhythm_All_Project_Sources_2026-07-12.zip` supplied for the 2026-07-12 consolidation.

## Current implementation rule

Do not rewrite the live 1.4.6 app in place. New work belongs in `/app` and must preserve local-first, non-clinical, user-confirmed and no-calendar-write boundaries.

The current `/app` loop includes Today, Plan, Pool and Library, Pool capture/holding, Pool-based open-capacity suggestions, user-confirmed soft placement, data-class-specific backup export/check paths including Task Pool status and deferral metadata, and local persistence for approved data classes. PR #107 is merged at `e11d6d5022a6118f96712b48ef5776d0a6acffbd` and establishes quiet shared in-flow headings, a compact shared header, a restrained local navigation marker, Pool as a Soft Ledger / Holding Tray with ledger rows and dividers, and a clarified Pool action hierarchy. The current next bounded visual sequence is Plan card-soup and pill-chip reduction, then Today dominant-active-object refinement, with Library and Setup later. Capture behaviour, action meaning and order, persistence, repositories, schemas, statuses, routes, task ordering, task lifecycle behaviour and user-confirmed placement remain unchanged. Automatic scheduling, calendar writes, repeating rhythm instances, broader resurfacing, `askFirst` placement, AI, backend, sync, notifications, analytics and restore/import execution remain future work.

## Evidence rule

Use the feature-specific packet anchors in the v1.2 evidence-balanced design spec. Packets 22 and 25 are global constraints, not default evidence for every feature.
