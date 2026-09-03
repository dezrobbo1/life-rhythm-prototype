# Life Rhythm MVP Plan

Status: Current delivery plan
Baseline: `main` at `e0c1d175e9082f7e5bdc5f1aeae6980146e4994b` (merged PR #112)

## MVP definition

The MVP is the first version that proves Life Rhythm can act as an external executive-function system rather than a manual task manager.

A user can:

1. give Life Rhythm real calendar commitments, tasks, rhythms and a small number of personal boundaries;
2. receive an automatically maintained private plan for the near term;
3. see a simple next-action view rather than operate the scheduling machinery manually;
4. have flexible internal work automatically repaired when circumstances change;
5. invoke Reduced Day and have the plan genuinely reduce demand;
6. use Minimum Done, re-entry and flexible rhythm semantics without creating catch-up debt;
7. move, defer, skip, protect or undo when the plan is wrong;
8. have those ordinary interactions recorded as future learning signals.

The MVP does not need AI or machine learning to prove this.

The defining product question is:

> Does Life Rhythm make fewer executive decisions necessary?

## MVP success criteria

The MVP is reached when the following end-to-end trial works with real personal data on a supported device/browser:

### Calendar reality

- At least one real read-only calendar source can be connected or imported through a calendar-adapter interface.
- Known commitments are preserved as hard external reality.
- Known travel/logistics can be represented where available.
- Empty calendar gaps are not automatically treated as productive capacity.

### Canonical tasks and rhythms

- One-off tasks persist independently of the visible daily plan.
- Rhythms represent useful frequency/window intentions rather than accumulating missed-event debt.
- Tasks can express deadline/usefulness information and duration uncertainty.
- Eligible tasks may have Minimum Done / normal / fuller variants while remaining one underlying intention.

### Automatic private scheduling

- Life Rhythm can construct a valid near-term plan without requiring the user to confirm every placement.
- Hard constraints and explicit protected boundaries cannot be silently violated.
- The scheduler can choose among flexible tasks and rhythms using explicit rules/preferences.
- The solver/algorithm is behind a scheduling-domain interface so implementation can change without rewriting the product model.

### Adaptive repair

- When an important input changes, Life Rhythm can repair the flexible part of the plan automatically.
- Past time is frozen.
- Near-term placements have increasing movement cost or equivalent schedule-inertia protection.
- Replanning changes the smallest reasonable region instead of rebuilding the whole visible day unnecessarily.
- Every automatic internal change is inspectable and can be undone or corrected.

### ADHD-support mechanisms are part of the scheduler

- Reduced Day changes scheduling demand rather than merely changing presentation.
- Minimum Done can substitute for an eligible normal task when appropriate.
- Re-entry reevaluates unfinished work instead of blindly rolling everything forward.
- Recovery/protected time can compete with productive work.
- Flexible rhythms do not create punitive catch-up piles.

### Calm surface

The daily interaction should be able to reduce to approximately:

- Now;
- Later;
- Changed;
- Move / Not now / Minimum done / Protect / Undo / Tell me why.

The MVP does not require the current Today / Plan / Pool / Library structure to remain unchanged if a simpler surface better serves this loop.

### Behavioural foundation

- Relevant scheduling events are recorded as facts: planned, started, moved, completed, deferred, overridden, duration and sparse feedback where provided.
- Explicit preferences are stored structurally with provenance.
- The event model does not encode speculative psychological or physiological explanations.
- The data model is ready for simple later duration/preference learning without requiring ML in the MVP.

### Resilience and safety

- Core state remains usable without an AI provider.
- External calendar truth is not silently mutated by the private scheduler.
- Destructive or externally consequential actions are outside automatic MVP authority.
- Local date/time and timezone behaviour is deterministic and tested.
- User data remain exportable and recoverable within the implemented data classes.

## Delivery sequence

### Gate 0 — Product and repository reset

Goal: make the repository describe the product we are actually building.

Deliverables:

- `PRODUCT.md` as product authority;
- this `MVP_PLAN.md` as delivery authority;
- `ARCHITECTURE.md` as target technical direction;
- concise research translation in `docs/RESEARCH_BASIS.md`;
- rewritten `AGENTS.md` that protects true invariants but permits product experimentation;
- old product contracts/design specifications reclassified as historical/reference rather than future-product law.

Exit condition: a new agent can read a small set of files and correctly conclude that automatic private scheduling, calendar alignment and adaptive learning are central product hypotheses rather than prohibited scope.

### Gate 1 — Canonical life model and scheduler seam

Goal: create a coherent model the future scheduler can operate on without rewriting the whole application.

Work:

- inventory and reuse existing task, Pool, Today, placement, settings and rhythm code;
- define canonical scheduling-domain types for external commitments, internal intentions, rhythm requirements, protected windows, task variants and placements;
- create a scheduler interface independent of OR-Tools or any other solver;
- create translation/adapters from existing persisted records where safe rather than performing a broad destructive migration;
- define deterministic invariants and fixture scenarios.

Do not redesign the UI in this gate unless needed to exercise the domain model.

Exit condition: current data can be projected into one scheduling-domain model and a trivial deterministic scheduler can return a valid plan.

### Gate 2 — Real calendar read and usable-day model

Goal: schedule against real life rather than manually marked `openCapacity` alone.

Work:

- implement the calendar-adapter interface with at least one real read-only source;
- model external event identity separately from Life Rhythm internal placements;
- reuse the PR #112 day-profile foundation where useful for workday/non-workday and usable-day context;
- represent known travel/logistics as hard constraints where reliable;
- represent preparation/transition/recovery as explicit or soft/contextual overhead;
- derive candidate intervals from usable-day boundaries minus hard/protected constraints and uncertainty reserve;
- keep blank calendar time distinct from usable capacity.

Exit condition: Life Rhythm can generate candidate scheduling intervals from a real calendar and explicit life boundaries without requiring every capacity block to be manually drawn.

### Gate 3 — Automatic Scheduler v0

Goal: prove the core invention.

Work:

- implement a deterministic heuristic or constraint optimiser behind the scheduler interface;
- support hard feasibility, explicit protected boundaries, deadlines/usefulness, basic capacity limits, rhythms and soft preferences;
- automatically place private flexible tasks/rhythms;
- generate a stable near-term plan;
- show short provenance for why a placement exists;
- add strong fixture and property-style tests for impossible overlaps and boundary violations.

Exit condition: tasks and rhythms can be automatically placed around real commitments with no per-placement confirmation loop.

### Gate 4 — Rolling repair and schedule inertia

Goal: remove repeated manual replanning.

Work:

- add event-driven replanning triggers;
- preserve the past and strongly preserve the near future;
- add movement cost/schedule inertia;
- repair only the necessary flexible region;
- support automatic private rescheduling after calendar changes, overruns, missed starts, completion changes and explicit user corrections;
- provide one-step undo and a concise Changed view.

Exit condition: a disrupted day can be repaired with substantially less manual intervention than the current soft-placement workflow.

### Gate 5 — Reduced Day, Minimum Done, rhythms and re-entry

Goal: ensure the scheduler behaves like Life Rhythm rather than a generic optimiser.

Work:

- integrate Reduced Day into scheduling objectives/capacity rules;
- preserve essentials and user-identified stabilising/restorative activities where appropriate;
- allow Minimum Done substitution without duplicating the task;
- model flexible rhythm windows/frequency and non-accumulating recurrence semantics;
- reevaluate missed/unfinished work by usefulness, deadline and purpose;
- prevent blanket catch-up debt;
- protect recovery as a legitimate scheduling objective.

Exit condition: low-capacity and disrupted-day flows require less executive work and do not create a punitive backlog explosion.

### Gate 6 — Calm daily surface

Goal: make the powerful scheduler feel simple.

Work:

- validate whether existing Today / Plan / Pool / Library navigation still helps;
- optimise for Now / Later / Changed rather than exposing internal scheduling objects by default;
- keep capture fast;
- make corrections low-friction;
- keep explanations short, grounded and optional;
- retain accessibility, keyboard and mobile requirements.

Do not preserve existing object grammar merely because it is documented. Reuse good visual work where it serves the MVP.

Exit condition: the user can operate the day without understanding Pool status, placement machinery, solver concepts or internal state boundaries.

### Gate 7 — Behavioural Learning v0

Goal: make Life Rhythm start learning without building a machine-learning platform.

Work:

- actual-duration statistics and uncertainty ranges;
- repeated-move/rejection statistics;
- time/context acceptance statistics;
- explicit preference hierarchy;
- source/provenance and basic confidence;
- recency weighting or simple decay;
- sparse enjoyment/restoration/activation feedback only when useful;
- a `What Life Rhythm has learnt about me` view with correct/reset/delete controls.

No contextual bandits, reinforcement learning, neural network or psychological personality model is required.

Exit condition: at least a small set of scheduling choices can improve from the user's own history while remaining explainable and correctable.

### Gate 8 — MVP personal trial and evidence gate

Goal: decide whether the product thesis works before adding AI complexity.

Run an instrumented longitudinal personal trial followed by a small beta.

Measure:

- minutes spent planning;
- number of manual scheduling actions;
- forgotten important intentions;
- invalid/conflicting placements;
- override/undo rate;
- initiation latency where observable;
- time/effort to recover after disruption;
- Reduced Day burden and next-day re-entry;
- unnecessary visible schedule moves;
- clarification/interaction burden;
- perceived trust and autonomy;
- continued voluntary use.

Raw task completion is secondary.

MVP passes when the adaptive version demonstrably reduces executive/planning burden without unacceptable schedule churn, conflict rate, pressure or loss of trust.

## Explicit MVP non-goals

Do not block MVP on:

- an LLM or conversational AI;
- managed premium AI;
- BYO provider credentials;
- contextual bandits;
- reinforcement learning;
- a local LLM;
- cloud behavioural models;
- automatic changes to external calendar commitments;
- email/message sending;
- perfect multi-provider calendar support;
- cloud sync unless independently justified;
- analytics containing user content;
- clinical claims or health-state inference;
- final visual polish across every historical screen;
- preserving every existing navigation or data-model choice.

## After MVP

### Optional AI v1

Add conversational capture, task decomposition, natural-language preference capture, ambiguity handling, schedule explanations and summaries of observed patterns through typed validated commands.

### Experimental personalisation

Use opt-in within-person/micro-randomised experiments for genuinely uncertain strategies such as quick-win sequencing, movement-before-task and alternative timing policies.

### Later learning

Consider contextual bandits only when event quality, safe candidate actions and proximal outcomes are mature. Full reinforcement learning remains out unless simpler methods demonstrably fail and a defensible objective exists.

### Commercial AI

If AI proves useful, managed Life Rhythm AI is the preferred first commercial path. Provider-neutral developer/BYO access can follow for users willing to manage credentials and billing.
