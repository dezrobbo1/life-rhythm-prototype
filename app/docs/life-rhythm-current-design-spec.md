# Life Rhythm Current Design Spec — Superseded

Status: Historical reference only

This file previously acted as the top-level product authority for `/app`.

That governance model was retired during the MVP product reset because it had accumulated implementation history, research interpretation, visual rules, future contracts and product hypotheses into one document. That made unvalidated product choices increasingly difficult for later agents to challenge.

Current authority is now:

1. [`../../PRODUCT.md`](../../PRODUCT.md) — product thesis and true invariants;
2. [`../../MVP_PLAN.md`](../../MVP_PLAN.md) — current delivery programme and MVP exit criteria;
3. [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — target technical architecture;
4. [`../../docs/RESEARCH_BASIS.md`](../../docs/RESEARCH_BASIS.md) — concise research translation;
5. current `/app` source and tests — what is actually implemented.

See [`../../docs/DOCUMENTATION_AUTHORITY.md`](../../docs/DOCUMENTATION_AUTHORITY.md) for the full authority map.

## Historical significance

The previous design spec documented the evolution through the Personal Trial, Pool/Today/Plan lifecycle work, Soft Ledger visual direction, soft-placement model, day-profile contract, rhythm-recurrence contract and the pre-MVP contract-first roadmap.

That history remains available in Git and in the associated contracts/handovers.

Do not reconstruct it here merely to make old documents look current.

## What changed in product direction

The current product direction explicitly treats the following as central hypotheses to build and validate rather than prohibited future scope:

- real calendar-aware planning;
- derived usable candidate availability;
- automatic private scheduling;
- automatic private rescheduling;
- rolling schedule repair and schedule inertia;
- Reduced Day as scheduler behaviour;
- Minimum Done substitution;
- flexible rhythm scheduling;
- re-entry recalculation;
- behavioural preference/duration learning;
- optional AI interpretation through typed validated commands.

The four-tab Today / Plan / Pool / Library shell, manual `openCapacity`-only suggestion model, user confirmation for every private placement and previous object-grammar contracts are not permanent product laws.

## What remains protected

The reset does not remove genuine safety or engineering boundaries.

Preserve:

- non-clinical positioning;
- no unsupported dopamine/neurochemical or hidden neurological-state claims;
- deterministic canonical state validation;
- no silent destructive, relational or externally consequential actions;
- calendar gaps are not automatically capacity;
- reversible/correctable private automation;
- user-controlled local-first personal data;
- no shame/debt/streak/productivity-punishment framing;
- timezone/migration/data-integrity safety;
- core planner operation without AI.

For implemented persistence, backup, migration or lifecycle details, an older contract may still contain technically relevant rationale. Treat that as subsystem reference, not broad product authority.
