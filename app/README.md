# Life Rhythm `/app`

Status: Current React/Vite/TypeScript implementation path for the adaptive MVP

The root 1.4.6 GitHub Pages PWA remains a protected legacy runtime. New product work targets `/app` unless a task explicitly says otherwise.

Read first:

- [`../PRODUCT.md`](../PRODUCT.md)
- [`../MVP_PLAN.md`](../MVP_PLAN.md)
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`../docs/RESEARCH_BASIS.md`](../docs/RESEARCH_BASIS.md)
- [`../docs/DOCUMENTATION_AUTHORITY.md`](../docs/DOCUMENTATION_AUTHORITY.md)

## Current implementation baseline

Current `main` baseline: merged PR #112 (`e0c1d175e9082f7e5bdc5f1aeae6980146e4994b`).

Reusable implementation includes:

- React/Vite/TypeScript application shell;
- Dexie local persistence and Zod validation;
- settings and Life Shape persistence;
- custom Library rhythm persistence;
- active Today task/status persistence;
- Task Pool capture, safe holding and deferral;
- linked Pool/Today/placement lifecycle transitions;
- usefulness/deadline fields and one-off time edges;
- Minimum Done and completion endpoints;
- re-entry preview/actions;
- protected/recovery/open-capacity concepts;
- current user-confirmed private soft placements;
- settings-owned Workday/Non-workday profile foundation with weekday assignment and safe rollback/migration handling;
- data-class-specific backup/export and read-only validation paths;
- user-scoped local namespaces under the optional identity shell;
- timezone-sensitive test coverage;
- responsive/accessibility and Soft Ledger visual foundations.

## Current implementation limitations

These are implementation facts, not product prohibitions.

`/app` does not yet provide:

- a real calendar adapter;
- derived candidate availability from calendar + usable-day boundaries;
- automatic private scheduling;
- automatic private rescheduling;
- rolling schedule repair or schedule inertia;
- behavioural duration/preference learning;
- an inspectable learnt-preference model;
- optional AI interpretation;
- external calendar writes;
- cloud sync;
- full import/restore execution;
- external tester readiness for the new adaptive MVP.

Current suggestions still use explicit `openCapacity` and current private placements remain user-confirmed because that is what the existing code implements. The MVP plan explicitly intends to replace that manual-only path with bounded automatic private scheduling once the scheduler seam and calendar model are ready.

## Current next gate

See [`../MVP_PLAN.md`](../MVP_PLAN.md).

The next implementation gate after the governance reset is:

> Gate 1 — Canonical life model and scheduler seam.

The objective is to project current persisted records into one scheduling-domain model without a destructive rewrite.

Reuse existing code where useful. Preserve data/migration safety, not historical abstractions for their own sake.

## Architectural transition

The intended progression is:

```text
existing persisted task/rhythm/settings state
        ↓
canonical scheduling-domain adapters
        ↓
stable scheduler interface
        ↓
real calendar context + usable-day model
        ↓
automatic private placement
        ↓
rolling repair + schedule inertia
        ↓
Reduced Day / Minimum Done / rhythm / re-entry integration
        ↓
simple behavioural learning
        ↓
optional AI interpretation later
```

Do not make the domain model inseparable from OR-Tools, CP-SAT or another solver. A deterministic heuristic can prove early vertical slices behind the same scheduler interface.

## Product direction relevant to `/app`

The primary product question is:

> Does the app make fewer executive decisions necessary?

This means the existing four-tab shell, Holding Tray terminology, manual placement flow and visual object grammar can change when the MVP demonstrates a simpler interaction.

Retain good interaction/accessibility work where it serves the product.

## Commands

```bash
npm ci
npm run dev
npm test
npm run build
```

When date/time/scheduling/calendar/re-entry behaviour changes, run timezone-sensitive tests in both UTC and Australia/Perth where the environment permits.

The `/app` build is currently a preview artifact and is not the protected root GitHub Pages deployment source.
