# Life Rhythm handover

Use this folder for continuity notes between research, design, implementation and Codex work.

## Current status

- Root `index.html` remains the protected public 1.4.6 legacy PWA.
- `/app` is the current React/Vite/TypeScript local-first Personal Trial v1 architecture.
- Latest application-code checkpoint: PR #109, merge commit `81f4211dd6970ce08dc63d717a570111388876be`.
- Latest visual implementation checkpoint: PR #109 — Plan Soft Ledger hierarchy.
- Approved product-contract checkpoint: PR #110 — day-profile/availability and rhythm recurrence/instance contracts; catalogue audit reviewed as planning input.
- Earlier shared foundation: PR #107 — quiet shared shell and Pool Soft Ledger / Holding Tray.
- Current product authority: `app/docs/life-rhythm-current-design-spec.md`.
- Current documentation map: `docs/DOCUMENTATION_AUTHORITY.md`.
- Current source provenance bundle: `Life_Rhythm_All_Project_Sources_2026-07-12.zip` supplied for the 2026-07-12 consolidation.

## Current implementation rule

Do not rewrite the live 1.4.6 app in place. New work belongs in `/app` and must preserve local-first, non-clinical, user-confirmed and no-calendar-write boundaries.

The current `/app` loop includes Today, Plan, Pool and Library, Pool capture/holding, Pool-based explicit-`openCapacity` suggestions, user-confirmed soft placement, data-class-specific backup export/check paths including Task Pool status and deferral metadata, and local persistence for approved data classes. Current behaviour remains local-first: soft placement is local and user-confirmed, nothing moves into Today automatically, and no calendar write occurs. PR #107 establishes quiet shared headings/header/navigation and Pool as a Soft Ledger / Holding Tray. PR #109 removes the three equal-weight outer Plan cards, establishes the Day Shape → Soft suggestions → Soft placements hierarchy, makes Day Shape the dominant connected planning object, and presents suggestions and placements as quieter ruled sections and rows. Its mobile, desktop, populated-state, keyboard and theme-parity visual review passed.

PR #109 changed presentation only. Selected-day behaviour, Day Shape content and ordering, explicit `openCapacity`, suggestion/eligibility/usefulness logic, user-confirmed placement, placement removal/reconfirmation, persistence, repositories, schemas, statuses, routes, task ordering and task lifecycle behaviour remain unchanged. Automatic scheduling, calendar writes, repeating rhythm instances, broader resurfacing, `askFirst` placement, AI, backend, sync, notifications, analytics and restore/import execution remain future work.

Approved product direction — runtime not implemented:

- [`../../app/docs/day-profile-and-availability-contract.md`](../../app/docs/day-profile-and-availability-contract.md) — approved product contract.
- [`../../app/docs/rhythm-recurrence-and-instance-contract.md`](../../app/docs/rhythm-recurrence-and-instance-contract.md) — approved product contract.
- [`../../app/docs/rhythm-library-catalogue-gap-audit.md`](../../app/docs/rhythm-library-catalogue-gap-audit.md) — reviewed product-planning input, not runtime authority.

Day profiles, derived availability, persistent recurrence, and rhythm instances remain unimplemented. The next bounded implementation is the first day-profile persistence and safe-migration foundation: Workday and Non-workday profile data structures, weekday assignment, preservation of existing settings as compatibility context, and an explicit migration-review state. It does not yet add profile-derived availability, derived work-hour suggestion behaviour, remove current explicit `openCapacity`, implement recurrence or instances, schedule automatically, or write calendars.

Later work continues through reviewed settings migration and activation, derived work boundaries, persistent rhythm plans and generated instances, Plan integration, and curated Library expansion. Today then receives the next bounded visual object pass, with Library and Setup later. Use the [current design spec roadmap](../../app/docs/life-rhythm-current-design-spec.md#18-current-near-term-roadmap) as the canonical sequence.

Non-blocking Plan follow-ups:

- inherited preferred-task context can remain briefly visible after placement;
- mobile empty-state copy can be reduced further;
- the global keyboard-focus colour needs a strict contrast audit.

## Evidence rule

Use the feature-specific packet anchors in the v1.2 evidence-balanced design spec. Packets 22 and 25 are global constraints, not default evidence for every feature.
