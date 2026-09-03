# Life Rhythm

Life Rhythm is an adaptive external executive-function support system designed primarily for adults with ADHD.

Its purpose is to reduce the cognitive and administrative work involved in remembering, organising, prioritising, initiating and replanning everyday life.

> Power underneath. Calm on the surface.

## Current product direction

The MVP is not a conventional task manager or manual soft-placement planner.

Life Rhythm is intended to combine real calendar commitments, tasks, rhythms, protected time, Reduced Day, Minimum Done, re-entry and explicit preferences into an automatically maintained private plan. Flexible internal work may be scheduled and rescheduled automatically. The user remains able to move, protect, defer, undo and correct the plan.

Behavioural learning should later improve durations, timing and preference choices from ordinary use. Optional AI may interpret natural language, decompose tasks and explain decisions, but it does not own canonical scheduling state.

Read these first:

1. [`PRODUCT.md`](PRODUCT.md) — product thesis and true invariants.
2. [`MVP_PLAN.md`](MVP_PLAN.md) — current gates and MVP exit criteria.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — target technical architecture.
4. [`docs/RESEARCH_BASIS.md`](docs/RESEARCH_BASIS.md) — concise evidence and claim boundaries.
5. [`docs/DOCUMENTATION_AUTHORITY.md`](docs/DOCUMENTATION_AUTHORITY.md) — current documentation authority.

## Repository generations

The repository contains two app generations:

- **Root `index.html`, `manifest.json`, `service-worker.js`** — protected live GitHub Pages 1.4.6 legacy PWA.
- **`/app`** — current React/Vite/TypeScript implementation path for the adaptive MVP.

The legacy root remains useful historical/product evidence but is not the authority for new `/app` behaviour.

## Current `/app` baseline

The current `main` baseline is merged PR #112 (`e0c1d175e9082f7e5bdc5f1aeae6980146e4994b`).

The `/app` already contains substantial reusable foundations, including:

- React/Vite/TypeScript;
- Dexie local persistence and Zod validation;
- settings and Life Shape data;
- Workday/Non-workday day-profile persistence foundations;
- custom rhythms;
- active Today task state;
- Task Pool capture/holding/deferral;
- usefulness/deadline support;
- Minimum Done/completion endpoints;
- re-entry work;
- protected/open-capacity concepts;
- user-confirmed internal soft placements;
- linked task/Pool/placement lifecycle logic;
- backup/export validation paths;
- timezone-sensitive tests;
- accessible responsive UI foundations.

Those are reusable implementation assets. They are not permanent product constraints.

Current main does **not** yet implement the target automatic scheduler, real calendar adapter, automatic private rescheduling, behavioural learning or optional AI layer.

## Current delivery gate

The current programme is defined in [`MVP_PLAN.md`](MVP_PLAN.md).

The first implementation gate after the product/documentation reset is:

> **Gate 1 — Canonical life model and scheduler seam**

The code should evolve incrementally from the existing `/app`. Do not rewrite the application from scratch merely to match the new architecture.

## Product and research boundary

Life Rhythm is non-clinical. Do not claim that it diagnoses or treats ADHD, regulates dopamine, detects hidden neurological states or provides medical advice.

Research supports external executive-function scaffolding and prospective-memory offloading strongly at the principle level. Automatic scheduling, automatic rescheduling and personalised sequencing are central product hypotheses that require real product validation rather than prohibition.

The primary MVP test is:

> **Does the app make fewer executive decisions necessary?**

## Development

For `/app`:

```bash
cd app
npm ci
npm test
npm run build
npm run dev
```

Date/time/scheduling tests should be checked in UTC and Australia/Perth when relevant.

See [`AGENTS.md`](AGENTS.md) before implementation work.

## Legacy GitHub Pages

The root 1.4.6 PWA remains deployed from repository root on `main`. It should not be changed as a side effect of `/app` MVP work unless a task explicitly targets the legacy app or deployment transition.
