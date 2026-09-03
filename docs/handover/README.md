# Life Rhythm handover

Use this folder for continuity notes between research, design, implementation and agent work.

## Current authority

Start with the active repository documents, in this order:

1. [`../../PRODUCT.md`](../../PRODUCT.md) — product purpose, direction and true invariants.
2. [`../../MVP_PLAN.md`](../../MVP_PLAN.md) — current path to MVP and active gate sequence.
3. [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — target technical architecture and transition strategy.
4. [`../RESEARCH_BASIS.md`](../RESEARCH_BASIS.md) — concise evidence translation and scientific boundaries.
5. [`../DOCUMENTATION_AUTHORITY.md`](../DOCUMENTATION_AUTHORITY.md) — repository documentation hierarchy.

The former `app/docs/life-rhythm-current-design-spec.md` is retained only as a historical redirect. It is not current product authority and its former roadmap is not the implementation sequence.

## Current implementation baseline

- Root `index.html` remains the protected public 1.4.6 legacy PWA.
- `/app` is the current React/Vite/TypeScript implementation path for the adaptive MVP.
- Current merged application baseline is PR #112 (`e0c1d175e9082f7e5bdc5f1aeae6980146e4994b`).
- Existing `/app` work includes local Dexie/Zod persistence, task/Pool/Today/placement lifecycle state, usefulness/deadline support, Minimum Done, re-entry behaviour, protected/recovery/open-capacity concepts, rhythm persistence, backup/export paths, timezone coverage, the day-profile persistence foundation, and responsive/accessibility foundations.

The current code still uses explicit `openCapacity` for suggestions and user-confirmed private placements. It does not yet read a real calendar, schedule private work automatically, perform rolling repair, learn behavioural preferences, or provide optional AI interpretation. Those are current implementation limitations, not product prohibitions.

## Current product direction

Life Rhythm is being developed as an adaptive external executive-function support system for adults with ADHD.

The intended direction is:

```text
real commitments + tasks + rhythms + protected life context
        ↓
deterministic scheduling-domain model
        ↓
automatic private planning and rolling repair
        ↓
Reduced Day / Minimum Done / recovery / re-entry integration
        ↓
simple behavioural learning
        ↓
optional AI interpretation later
```

Automatic private scheduling, automatic private rescheduling, calendar alignment and behavioural learning are central MVP hypotheses to build and test. They do not require a new product contract merely because the existing runtime is manual.

The primary product question is:

> Does the app make fewer executive decisions necessary?

## Current next gate

Use [`../../MVP_PLAN.md`](../../MVP_PLAN.md) as the canonical sequence.

The next implementation milestone after the governance reset is:

> **Gate 1 — Canonical life model and scheduler seam.**

The objective is to project reusable current persisted state into a coherent scheduling-domain model behind a stable scheduler interface, without a destructive rewrite.

Do not resume the previous contract-first sequence of day-profile activation → recurrence → visual passes merely because older handovers or contracts describe it.

## Research and historical material

The consolidated `Life_Rhythm_All_Project_Sources_2026-07-12.zip`, packet collection, older design specifications, visual contracts, handovers and source-library records remain useful evidence, provenance and implementation history.

They do not override `PRODUCT.md`, `MVP_PLAN.md`, `ARCHITECTURE.md`, current code/tests, or `docs/RESEARCH_BASIS.md`.

Research should establish evidence strength, scientific boundaries and worthwhile hypotheses. It should not silently convert an unvalidated implementation idea into either a permanent requirement or a permanent prohibition.
