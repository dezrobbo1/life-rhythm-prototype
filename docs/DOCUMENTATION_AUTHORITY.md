# Life Rhythm Documentation Authority

Status: Current repository authority map
Baseline before reset: `main` at `e0c1d175e9082f7e5bdc5f1aeae6980146e4994b` (PR #112)

## Purpose

This file prevents two opposite failures:

1. treating historical prototype material as current product law;
2. turning research uncertainty into permanent prohibitions that stop Life Rhythm from testing its central product hypotheses.

The repository is now organised around a small current authority set.

## Current authority order

### 1. Product direction

[`../PRODUCT.md`](../PRODUCT.md)

Defines what Life Rhythm is, the product thesis and the true scientific/safety/product invariants.

### 2. Current delivery target

[`../MVP_PLAN.md`](../MVP_PLAN.md)

Defines the current MVP, delivery gates, exit criteria and explicit non-goals.

### 3. Target technical architecture

[`../ARCHITECTURE.md`](../ARCHITECTURE.md)

Defines the intended system boundaries: canonical structured state, deterministic scheduler, calendar adapter, behavioural learning, optional AI and risk-calibrated actions.

Architecture choices remain changeable when implementation evidence shows a better route.

### 4. Current implementation and tests

The `/app` source, schemas, migrations, repositories and tests are authoritative for what the application actually does today.

Implementation facts do not automatically become permanent product requirements.

### 5. Research basis

[`RESEARCH_BASIS.md`](RESEARCH_BASIS.md)

Summarises the current evidence classifications, scientific claim boundaries and architecture research.

Research constrains claims and identifies risks. It also identifies hypotheses worth testing. `Not validated` does not mean `forbidden to prototype`.

### 6. Historical/reference material

Existing contracts, design specifications, visual boards, research-governance files, handovers and source packs remain useful history and implementation reference unless explicitly promoted by the authority files above.

They do not override `PRODUCT.md`, `MVP_PLAN.md` or `ARCHITECTURE.md`.

## Status of previous current-design and contract documents

The following classes of documents are no longer top-level product authority:

- `app/docs/life-rhythm-current-design-spec.md`;
- soft-scheduling contracts;
- navigation redesign contracts;
- object-grammar and visual-direction contracts;
- day-profile/availability future-product contract;
- rhythm-recurrence/instance future-product contract;
- catalogue planning audits;
- older research-to-MVP governance maps;
- `.codex/tasks/*` instructions not explicitly referenced by a current task.

They remain useful for:

- understanding why existing code looks the way it does;
- preserving migration/data-model rationale;
- reusing good interaction or visual work;
- locating previous decisions and tests;
- avoiding accidental regression of implemented data integrity.

They must not be read as prohibiting current MVP work such as automatic private scheduling, automatic private rescheduling, calendar reading, derived candidate availability or behavioural learning.

## Binding runtime contracts

An older contract may still be binding for an **implemented technical invariant** when changing that subsystem, for example:

- persisted schema compatibility;
- migration safety;
- backup format compatibility;
- data-class boundaries currently required to avoid corruption;
- timezone/date semantics;
- transactional lifecycle invariants;
- accessibility behaviour already depended on by tests/users.

That technical binding does not make the contract's broader future-product assumptions authoritative.

If a current MVP change needs to alter an implemented invariant, update code, tests, migration/backup handling and the smallest relevant current documentation together.

## Two application generations

| Area | Status | Authority |
| --- | --- | --- |
| Root `index.html`, `manifest.json`, `service-worker.js` | Live legacy 1.4.6 PWA | Protected deployment/runtime unless explicitly targeted |
| `/app` | Current React/Vite/TypeScript implementation | Current implementation path for MVP |
| `/app` data | Dexie/Zod local-first state | Reusable implementation foundation; may evolve safely |
| Future scheduler/learning/AI | Target defined in current top-level docs | Build and validate incrementally |

Do not rewrite the legacy root app as a side effect of `/app` work.

Do not copy legacy behaviour merely because it exists.

## Current implementation snapshot

At baseline PR #112, `/app` includes:

- settings/Life Shape persistence;
- Workday/Non-workday day-profile persistence foundation and safe migration handling;
- custom rhythm persistence;
- active Today task/status persistence;
- Task Pool capture, holding and deferral;
- usefulness/deadline support;
- Minimum Done/completion endpoints;
- re-entry work;
- explicit protected/open-capacity concepts;
- user-confirmed private soft placements;
- linked Pool/Today/placement transitions;
- local backup/export validation paths;
- opt-in local identity namespaces;
- current visual shell/Soft Ledger work.

It does not yet implement the target automatic scheduler, real calendar adapter, automatic private replanning, behavioural learning or optional AI layer.

The current next programme is defined only by `MVP_PLAN.md`, not by the older contract-first roadmap.

## Product hypotheses explicitly in scope

These may be implemented through bounded MVP experiments without first writing a new product contract:

- automatic private scheduling;
- automatic private rescheduling;
- calendar-aware planning;
- derived candidate availability;
- schedule inertia;
- Reduced Day scheduler behaviour;
- Minimum Done substitution;
- flexible rhythm scheduling;
- re-entry recalculation;
- simple behavioural learning;
- preference confidence/decay;
- sparse enjoyment/restoration feedback;
- later optional AI interpretation through typed validated commands.

A product contract is appropriate when it helps resolve a genuinely high-risk write/migration/privacy/external-action boundary. It is not a prerequisite for ordinary product discovery.

## True boundaries that remain protected

See `PRODUCT.md` and `AGENTS.md`. In summary:

- non-clinical positioning and no unsupported neurochemical/health-state claims;
- deterministic canonical state validation;
- no silent destructive/relational/external consequential action;
- blank calendar time is not automatically capacity;
- automatic internal work remains correctable/reversible;
- personal data remain user-controlled and minimised;
- no shame/debt/streak/productivity-punishment framing;
- core planner does not depend on AI.

## Updating documentation

Do not reconcile every old contract after every PR.

Update:

- `PRODUCT.md` only when product direction or true invariants change;
- `MVP_PLAN.md` when gates, exit criteria or current programme change;
- `ARCHITECTURE.md` when architectural boundaries materially change;
- `RESEARCH_BASIS.md` when a new reviewed research source materially changes the evidence position;
- implementation-specific docs only when their technical subsystem needs them.

Historical documents should remain historical rather than being repeatedly rewritten to look current.
